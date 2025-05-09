import yaml from 'js-yaml';

export default {
  async fetch(request, env, ctx) {
    // 设置 CORS 头部
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // 处理 OPTIONS 请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // 获取请求 URL 和路径
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 快速路径：处理常见的特殊请求
    if (pathname === '/favicon.ico') {
      return new Response(null, { status: 204 }); // 返回无内容响应
    }
    
    if (pathname === '/robots.txt') {
      return new Response('User-agent: *\nDisallow: /', {
        headers: { 'Content-Type': 'text/plain' }
      });
    }
    
    if (pathname !== '/') {
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      });
    }
    
    // 获取完整的原始查询字符串
    const queryString = url.search;
    
    // 从原始查询字符串中提取 yamlUrl 参数的完整值
    let yamlUrlParam = null;
    const urlMatch = queryString.match(/[?&]url=([^&]+)/);
    if (urlMatch && urlMatch[1]) {
      // 解码URL参数
      yamlUrlParam = decodeURIComponent(urlMatch[1]);
    }
    
    // 使用标准方法获取其他参数
    let nameFilter = url.searchParams.get('name');
    let typeFilter = url.searchParams.get('type');
    
    // 如果未提供参数，尝试使用环境变量中的默认值
    // 环境变量优先级: URL参数 > 环境变量
    if (!yamlUrlParam && env.DEFAULT_URL) {
      yamlUrlParam = env.DEFAULT_URL;
    }
    
    if (!nameFilter && env.DEFAULT_NAME_FILTER) {
      nameFilter = env.DEFAULT_NAME_FILTER;
    }
    
    if (!typeFilter && env.DEFAULT_TYPE_FILTER) {
      typeFilter = env.DEFAULT_TYPE_FILTER;
    }
    
    // 强制应用环境变量中的过滤器（如果存在）
    // 这些过滤器会与用户提供的过滤器一起应用
    const forceNameFilter = env.FORCE_NAME_FILTER;
    const forceTypeFilter = env.FORCE_TYPE_FILTER;

    // 验证必要参数
    if (!yamlUrlParam) {
      return new Response('Error: Missing required parameter "url" or DEFAULT_URL environment variable', {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // 分割多URL参数（用逗号分隔）
    const yamlUrls = yamlUrlParam.split(',').map(u => u.trim()).filter(u => u);
    
    // 限制URL数量，避免过多处理
    if (yamlUrls.length > 10) {
      return new Response('Error: Too many URLs provided (maximum 10 allowed)', {
        status: 400,
        headers: corsHeaders
      });
    }

    try {
      // 合并配置结果
      let mergedProxies = [];
      let firstConfig = null;
      let totalOriginalCount = 0;
      let sourceUrlInfo = [];
      
      // 并行处理所有URL（而不是串行）
      const configPromises = yamlUrls.map(yamlUrl => 
        fetchAndParseYaml(yamlUrl)
          .then(result => ({ yamlUrl, ...result }))
          .catch(e => ({ yamlUrl, error: e.message }))
      );
      
      // 等待所有请求完成
      const results = await Promise.all(configPromises);
      
      // 处理所有结果
      for (const result of results) {
        const { yamlUrl, config, error } = result;
        
        if (error) {
          sourceUrlInfo.push(`${yamlUrl} (错误: ${error})`);
          continue;
        }
        
        // 初始化第一个有效配置作为基础配置
        if (!firstConfig && config) {
          firstConfig = config;
        }
        
        // 添加代理到合并列表
        if (config && config.proxies && Array.isArray(config.proxies)) {
          totalOriginalCount += config.proxies.length;
          mergedProxies = [...mergedProxies, ...config.proxies];
          sourceUrlInfo.push(`${yamlUrl} (${config.proxies.length}个节点)`);
          
          // 限制处理节点数量，避免超出CPU限制
          if (totalOriginalCount > 10000) {
            return new Response('Error: Too many proxies to process (limit: 10000)', {
              status: 400,
              headers: corsHeaders
            });
          }
        }
      }
      
      // 验证是否有有效的配置
      if (!firstConfig) {
        return new Response('Error: No valid configuration found from the provided URLs', {
          status: 400,
          headers: corsHeaders
        });
      }

      // 验证是否有代理节点
      if (mergedProxies.length === 0) {
        return new Response('Error: No proxies found in the configurations', {
          status: 400,
          headers: corsHeaders
        });
      }

      // 节点去重
      const beforeDedupeCount = mergedProxies.length;
      mergedProxies = deduplicateProxies(mergedProxies);
      const afterDedupeCount = mergedProxies.length;
      const duplicateCount = beforeDedupeCount - afterDedupeCount;
      
      // 构建有效的过滤器
      const effectiveNameFilter = combineFilters(nameFilter, forceNameFilter);
      const effectiveTypeFilter = combineFilters(typeFilter, forceTypeFilter);
      
      // 过滤节点
      let filteredProxies = filterProxies(
        mergedProxies, 
        effectiveNameFilter, 
        effectiveTypeFilter
      );
      
      // 提取用于重命名的前缀
      let renamingPrefix = null;
      
      // 如果有名称过滤器，提取它的内容作为重命名前缀
      if (nameFilter) {
        // 尝试提取简单的名称过滤规则作为前缀
        // 假设过滤器是简单的关键字或词组，而不是复杂的正则表达式
        renamingPrefix = extractPrefixFromFilter(nameFilter);
      }
      
      // 重命名节点，如果有指定前缀则使用它
      filteredProxies = renameProxies(filteredProxies, renamingPrefix);
      
      // 记录过滤后节点数量
      const filteredCount = filteredProxies.length;
      
      // 创建新的配置
      const filteredConfig = {...firstConfig, proxies: filteredProxies};
      
      // 如果有 proxy-groups，更新它们以仅包含过滤后的节点
      if (firstConfig['proxy-groups'] && Array.isArray(firstConfig['proxy-groups'])) {
        filteredConfig['proxy-groups'] = updateProxyGroups(
          firstConfig['proxy-groups'], 
          filteredProxies.map(p => p.name)
        );
      }

      // 添加过滤信息作为注释
      const filterInfo = `# 原始节点总计: ${totalOriginalCount}, 去重后: ${afterDedupeCount} (移除了${duplicateCount}个重复节点), 过滤后节点: ${filteredCount}\n` +
                         `# 名称过滤: ${nameFilter || '无'} ${forceNameFilter ? '(强制: ' + forceNameFilter + ')' : ''}\n` +
                         `# 类型过滤: ${typeFilter || '无'} ${forceTypeFilter ? '(强制: ' + forceTypeFilter + ')' : ''}\n` +
                         `# 生成时间: ${new Date().toISOString()}\n` +
                         `# 配置源: \n# ${sourceUrlInfo.join('\n# ')}\n`;
      
      // 生成 YAML 并返回
      const yamlString = filterInfo + yaml.dump(filteredConfig);
      
      return new Response(yamlString, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/yaml; charset=utf-8'
        }
      });
    } catch (error) {
      return new Response(`Error: ${error.message}`, {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

/**
 * 从过滤器中提取可用作前缀的简单字符串
 * @param {string} filter 过滤器规则
 * @returns {string|null} 提取的前缀或null
 */
function extractPrefixFromFilter(filter) {
  if (!filter) return null;
  
  // 处理最常见的简单过滤场景
  
  // 如果过滤器是简单字词
  if (/^[^\|\[\]\(\)\^\$\.\*\+\?\\]+$/.test(filter)) {
    return filter;
  }
  
  // 尝试识别常见的OR模式的第一部分，如 "日本|美国|香港"
  const orMatch = filter.match(/^([^\|\[\]\(\)\^\$\.\*\+\?\\]+)\|/);
  if (orMatch) {
    return orMatch[1];
  }
  
  // 对于更复杂的正则模式，尝试一些常见模式
  // 如 (日本) 或 [日本] 等
  const patternMatch = filter.match(/[\(\[](.*?)[\)\]]/);
  if (patternMatch) {
    return patternMatch[1];
  }
  
  // 无法提取合适的前缀，使用默认值
  return "node";
}

/**
 * 获取并解析 YAML 配置
 * @param {string} yamlUrl YAML 配置URL
 * @returns {Object} 包含配置对象或错误信息
 */
async function fetchAndParseYaml(yamlUrl) {
  try {
    // 设置获取超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
    
    // 获取 YAML 配置
    const response = await fetch(yamlUrl, { 
      signal: controller.signal,
      cf: { cacheTtl: 300 } // 缓存5分钟
    }).catch(err => {
      if (err.name === 'AbortError') {
        return { ok: false, status: 408, statusText: 'Request Timeout' };
      }
      throw err;
    });
    
    clearTimeout(timeoutId); // 清除超时
    
    if (!response.ok) {
      return { 
        error: `HTTP ${response.status} ${response.statusText}`
      };
    }

    const yamlContent = await response.text();
    
    // 解析 YAML
    const config = yaml.load(yamlContent);
    
    // 验证配置格式
    if (!config || !config.proxies || !Array.isArray(config.proxies)) {
      return {
        error: "无效的配置格式或缺少proxies数组"
      };
    }
    
    return { config };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * 节点去重
 * 根据节点的关键属性（服务器、端口、类型等）去除重复节点
 */
function deduplicateProxies(proxies) {
  const uniqueProxies = [];
  const seen = new Set();
  
  for (const proxy of proxies) {
    // 创建一个唯一标识，包含节点的核心配置
    // 对于不同类型的节点，确保包含所有关键字段
    let uniqueKey;
    
    if (proxy.type === 'ss') {
      uniqueKey = `${proxy.type}:${proxy.server}:${proxy.port}:${proxy.cipher}`;
    } else if (proxy.type === 'ssr') {
      uniqueKey = `${proxy.type}:${proxy.server}:${proxy.port}:${proxy.cipher}:${proxy.protocol}:${proxy.obfs}`;
    } else if (proxy.type === 'vmess') {
      uniqueKey = `${proxy.type}:${proxy.server}:${proxy.port}:${proxy.uuid}:${proxy.alterId || 0}`;
    } else if (proxy.type === 'trojan') {
      uniqueKey = `${proxy.type}:${proxy.server}:${proxy.port}:${proxy.password}`;
    } else if (proxy.type === 'http' || proxy.type === 'https' || proxy.type === 'socks5' || proxy.type === 'socks5-tls') {
      uniqueKey = `${proxy.type}:${proxy.server}:${proxy.port}:${proxy.username || ''}:${proxy.password || ''}`;
    } else {
      // 对于未知类型的节点，使用JSON字符串作为唯一标识
      // 排除name字段，因为名称不同但配置相同的节点应被视为重复
      const { name, ...config } = proxy;
      uniqueKey = JSON.stringify(config);
    }
    
    if (!seen.has(uniqueKey)) {
      seen.add(uniqueKey);
      uniqueProxies.push(proxy);
    }
  }
  
  return uniqueProxies;
}

/**
 * 结合两个过滤器
 * 如果两个过滤器都存在，则创建一个匹配两者的正则表达式
 */
function combineFilters(userFilter, forceFilter) {
  if (!userFilter && !forceFilter) return null;
  if (!userFilter) return forceFilter;
  if (!forceFilter) return userFilter;
  
  // 两个过滤器都存在，创建匹配两者的正则表达式
  return `(?=${userFilter})(?=${forceFilter})`;
}

/**
 * 过滤代理节点
 */
function filterProxies(proxies, nameFilter, typeFilter) {
  return proxies.filter(proxy => {
    let nameMatch = true;
    let typeMatch = true;

    if (nameFilter && proxy.name) {
      try {
        const nameRegex = new RegExp(nameFilter);
        nameMatch = nameRegex.test(proxy.name);
      } catch (error) {
        console.warn('Invalid name regex:', error);
        nameMatch = true;
      }
    }

    if (typeFilter && proxy.type) {
      try {
        const typeRegex = new RegExp(typeFilter);
        typeMatch = typeRegex.test(proxy.type);
      } catch (error) {
        console.warn('Invalid type regex:', error);
        typeMatch = true;
      }
    }

    return nameMatch && typeMatch;
  });
}

/**
 * 重命名代理节点
 * 如果提供了固定前缀，则使用该前缀统一命名所有节点
 * 否则，按原规则：用"_"分割原始名称并取第一个
 * @param {Array} proxies 要重命名的代理节点数组
 * @param {string} fixedPrefix 固定前缀，如果为null则使用原始节点名称第一部分
 * @returns {Array} 重命名后的节点数组
 */
function renameProxies(proxies, fixedPrefix) {
  // 用于跟踪节点计数
  let counter = 0;
  
  // 如果有固定前缀，使用它统一命名所有节点
  if (fixedPrefix) {
    return proxies.map(proxy => {
      counter++;
      return {
        ...proxy,
        name: `${fixedPrefix}_${counter}`
      };
    });
  }
  
  // 否则使用原来的重命名逻辑（取节点名称的第一部分）
  const prefixCounts = {};
  
  return proxies.map(proxy => {
    if (proxy.name) {
      // 分割名称并获取第一部分
      const parts = proxy.name.split('_');
      const prefix = parts[0] || 'node';
      
      // 更新该前缀的计数
      prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
      
      // 创建新名称
      const newName = `${prefix}_${prefixCounts[prefix]}`;
      
      // 返回带有新名称的代理节点
      return {
        ...proxy,
        name: newName
      };
    }
    return proxy;
  });
}

/**
 * 更新代理组
 */
function updateProxyGroups(proxyGroups, validProxyNames) {
  return proxyGroups.map(group => {
    if (group.proxies && Array.isArray(group.proxies)) {
      const updatedProxies = group.proxies.filter(name => 
        validProxyNames.includes(name) || 
        proxyGroups.some(g => g.name === name) ||
        name === 'DIRECT' || name === 'REJECT'
      );
      
      return {
        ...group,
        proxies: updatedProxies.length > 0 ? updatedProxies : ['DIRECT']
      };
    }
    return group;
  });
}