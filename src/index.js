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

    // 解析 URL 查询参数
    const url = new URL(request.url);
    
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

    try {
      // 合并配置结果
      let mergedProxies = [];
      let firstConfig = null;
      let totalOriginalCount = 0;
      let sourceUrlInfo = [];
      
      // 处理每个URL
      for (const yamlUrl of yamlUrls) {
        try {
          // 获取和解析YAML
          const { config, error } = await fetchAndParseYaml(yamlUrl);
          
          if (error) {
            sourceUrlInfo.push(`${yamlUrl} (错误: ${error})`);
            continue;
          }
          
          // 初始化第一个有效配置作为基础配置
          if (!firstConfig) {
            firstConfig = config;
          }
          
          // 添加代理到合并列表
          if (config.proxies && Array.isArray(config.proxies)) {
            totalOriginalCount += config.proxies.length;
            mergedProxies = [...mergedProxies, ...config.proxies];
            sourceUrlInfo.push(`${yamlUrl} (${config.proxies.length}个节点)`);
          }
        } catch (e) {
          sourceUrlInfo.push(`${yamlUrl} (错误: ${e.message})`);
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

      // 构建有效的过滤器
      const effectiveNameFilter = combineFilters(nameFilter, forceNameFilter);
      const effectiveTypeFilter = combineFilters(typeFilter, forceTypeFilter);
      
      // 过滤节点
      let filteredProxies = filterProxies(
        mergedProxies, 
        effectiveNameFilter, 
        effectiveTypeFilter
      );
      
      // 重命名节点
      filteredProxies = renameProxies(filteredProxies);
      
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
      const filterInfo = `# 原始节点总计: ${totalOriginalCount}, 过滤后节点: ${filteredCount}\n` +
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
 * 获取并解析 YAML 配置
 * @param {string} yamlUrl YAML 配置URL
 * @returns {Object} 包含配置对象或错误信息
 */
async function fetchAndParseYaml(yamlUrl) {
  try {
    // 获取 YAML 配置
    const response = await fetch(yamlUrl);
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
 * 规则：用"_"分割原始名称并取第一个，之后拼接上序号
 */
function renameProxies(proxies) {
  // 用于跟踪每个前缀的计数
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