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
      
      // 处理直接提供的Base64数据内容
      if (yamlUrlParam.startsWith('data:') && yamlUrlParam.includes('base64,')) {
        try {
          const base64Content = yamlUrlParam.split('base64,')[1];
          const decodedContent = atob(base64Content);
          
          // 处理解码后的内容
          return await processDirectContent(decodedContent, url, env, corsHeaders);
        } catch (e) {
          return new Response(`Error processing Base64 content: ${e.message}`, {
            status: 400,
            headers: corsHeaders
          });
        }
      }
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
    if (yamlUrls.length > 100) {
      return new Response('Error: Too many URLs provided (maximum 100 allowed)', {
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
          if (totalOriginalCount > 100000) {
            return new Response('Error: Too many proxies to process (limit: 100000)', {
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

    let content = await response.text();
    
    // 预处理YAML内容，移除特殊标签
    content = preprocessYamlContent(content);
    
    // 检查内容是否为Base64编码
    if (isBase64(content)) {
      try {
        // 尝试解码Base64内容
        const decodedContent = atob(content.trim());
        content = decodedContent;
        // 解码后再次预处理
        content = preprocessYamlContent(content);
      } catch (decodeError) {
        console.warn("Base64解码失败", decodeError);
        // 如果解码失败，继续使用原始内容
      }
    }
    
    // 修改解析策略: 优先尝试YAML解析，这是最常见的情况
    let config;
    let yamlError = null;
    
    // 1. 首先尝试解析为YAML (最常见情况)
    try {
      config = yaml.load(content);
      
      // 验证配置格式
      if (config && typeof config === 'object') {
        // 确认是否包含代理节点，或者至少是一个对象
        if (config.proxies && Array.isArray(config.proxies) && config.proxies.length > 0) {
          return { config };
        }
        
        // 如果仅缺少proxies字段但其他字段存在，可能是不完整的配置，我们可以添加空proxies
        if (Object.keys(config).length > 0) {
          config.proxies = config.proxies || [];
          return { config };
        }
      }
    } catch (error) {
      yamlError = error;
      // YAML解析失败，将继续尝试URI列表解析
      console.warn("YAML解析失败:", error.message);
    }
    
    // 2. 检查内容是否确实包含节点URI特征
    const hasNodeURIs = checkForNodeURIs(content);
    
    // 3. 如果包含节点URI特征，尝试作为URI列表处理
    if (hasNodeURIs) {
      try {
        config = parseURIListToConfig(content);
        if (config && config.proxies && Array.isArray(config.proxies) && config.proxies.length > 0) {
          return { config };
        }
      } catch (uriError) {
        console.warn("URI列表解析失败:", uriError.message);
      }
    }
    
    // 4. 如果之前的YAML解析部分成功但没有代理，检查是否有其他关键字段
    if (config && typeof config === 'object' && Object.keys(config).length > 0) {
      // 有些配置可能仅包含rules或proxy-groups但没有proxies
      // 我们可以添加一个空的proxies数组以使其符合要求
      config.proxies = [];
      return { config };
    }
    
    // 5. 所有解析方法都失败
    return {
      error: yamlError 
        ? `YAML解析错误: ${yamlError.message}` 
        : "无效的配置格式或无法识别的节点格式"
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * 检查内容是否包含节点URI
 * @param {string} content 要检查的内容
 * @returns {boolean} 是否包含节点URI
 */
function checkForNodeURIs(content) {
  if (!content) return false;
  
  // 将内容分成行
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  
  // 协议前缀列表
  const protocolPrefixes = ['vmess://', 'ss://', 'ssr://', 'trojan://', 'hysteria2://', 'vless://'];
  
  let validUriCount = 0;
  let totalLines = lines.length;
  
  // 检查是否有行以协议前缀开头
  for (const line of lines) {
    for (const prefix of protocolPrefixes) {
      // 更简单的检测：如果行以协议前缀开头且不是YAML文档的一部分，则认为是有效的URI
      if (line.startsWith(prefix)) {
        // 排除明显是YAML格式的行 
        if (!line.includes('name:') && 
            !line.includes('server:') && 
            !line.includes('port:') && 
            !line.includes('type:') &&
            !line.includes(': {') &&
            !line.includes('- {')) {
          validUriCount++;
          break;
        }
      }
    }
  }
  
  // 如果总行数很少（<10行）且至少有一个URI，或者
  // 如果有多行URI（>1行）且占比较高（>30%），则认为是URI列表
  return (totalLines < 10 && validUriCount > 0) || 
         (validUriCount > 1 && (validUriCount / totalLines) > 0.3);
}

/**
 * 检查字符串是否为Base64编码
 * @param {string} str 要检查的字符串
 * @returns {boolean} 是否为Base64编码
 */
function isBase64(str) {
  if (!str || typeof str !== 'string') return false;
  
  // 忽略过短的内容
  if (str.length < 50) return false;
  
  // 1. 标准格式检查: 只允许Base64字符集
  const base64Regex = /^[A-Za-z0-9+/=\r\n]+$/;
  if (!base64Regex.test(str)) {
    return false;
  }
  
  // 2. 长度验证: Base64编码的字符串长度应该是4的倍数(可能有填充)
  const cleanStr = str.replace(/[\r\n]/g, '');
  if (cleanStr.endsWith('=')) {
    // 如果有填充字符，移除填充后应该是4的倍数
    if (cleanStr.endsWith('==')) {
      if ((cleanStr.length - 2) % 4 !== 0) return false;
    } else {
      if ((cleanStr.length - 1) % 4 !== 0) return false;
    }
  } else if (cleanStr.length % 4 !== 0) {
    return false;
  }
  
  try {
    // 3. 尝试解码
    const decoded = atob(cleanStr);
    
    // 4. 解码后检查: 过滤掉肯定是YAML文本的内容
    if (decoded.startsWith('proxies:') || 
        decoded.includes('mixed-port:') || 
        decoded.startsWith('port:') ||
        decoded.includes('proxy-groups:')) {
      return true;  // 这是Base64编码的YAML，应该解码
    }
    
    // 5. 计算文本内容比例
    const textChars = decoded.split('').filter(c => {
      const code = c.charCodeAt(0);
      return code >= 32 && code <= 126; // ASCII可打印字符范围
    }).length;
    
    const textRatio = textChars / decoded.length;
    
    // 如果解码后可读文本比例较高，且内容够长，可能是文本内容
    if (textRatio > 0.7 && decoded.length > 30) {
      // 检查是否包含节点URI特征
      if (decoded.includes('vmess://') || 
          decoded.includes('ss://') || 
          decoded.includes('trojan://') ||
          decoded.includes('vless://') || 
          decoded.includes('hysteria2://')) {
        return true; // 这是Base64编码的节点列表，应该解码
      }
      
      // 检查是否包含YAML特征
      if (decoded.includes('name:') && 
          (decoded.includes('server:') || decoded.includes('port:') || decoded.includes('type:'))) {
        return true; // 这是Base64编码的节点配置，应该解码
      }
    }
    
    // 默认情况，如果文本比例高且没有二进制特征，倾向于认为是Base64编码
    return textRatio > 0.9;
  } catch (e) {
    // 解码失败，不是有效的Base64
    return false;
  }
}

/**
 * 解析节点URI列表并转换为Clash配置
 * @param {string} content URI列表文本
 * @returns {Object} Clash配置对象
 */
function parseURIListToConfig(content) {
  // 分割为行并过滤空行
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  
  if (lines.length === 0) {
    return null;
  }
  
  // 处理所有类型的URI
  const proxies = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const proxy = parseURI(line);
    
    if (proxy) {
      proxies.push(proxy);
    }
  }
  
  if (proxies.length === 0) {
    return null;
  }
  
  // 创建默认配置
  return {
    port: 7890,
    'socks-port': 7891,
    'allow-lan': true,
    mode: 'rule',
    'log-level': 'info',
    proxies: proxies,
    'proxy-groups': [
      {
        name: '节点选择',
        type: 'select',
        proxies: ['DIRECT', ...proxies.map(p => p.name)]
      }
    ],
    rules: [
      'MATCH,节点选择'
    ]
  };
}

/**
 * 解析单个节点URI
 * @param {string} uri 节点URI
 * @returns {Object|null} 解析后的节点对象，解析失败返回null
 */
function parseURI(uri) {
  try {
    // 提取URI中的注释部分作为名称
    let name = '';
    const hashIndex = uri.indexOf('#');
    if (hashIndex !== -1) {
      name = decodeURIComponent(uri.substring(hashIndex + 1));
      uri = uri.substring(0, hashIndex);
    }
    
    // 处理不同类型的URI
    if (uri.startsWith('hysteria2://')) {
      return parseHysteria2URI(uri, name);
    } else if (uri.startsWith('vmess://')) {
      return parseVmessURI(uri, name);
    } else if (uri.startsWith('ss://')) {
      return parseSsURI(uri, name);
    } else if (uri.startsWith('trojan://')) {
      return parseTrojanURI(uri, name);
    } else if (uri.startsWith('vless://')) {
      return parseVlessURI(uri, name);
    } else if (uri.startsWith('ssr://')) {
      return parseSsrURI(uri, name);
    }
    
    // 不支持的URI类型
    return null;
  } catch (error) {
    console.warn('URI解析错误:', error, uri);
    return null;
  }
}

/**
 * 解析Hysteria2节点URI
 * @param {string} uri Hysteria2 URI
 * @param {string} name 节点名称
 * @returns {Object} Hysteria2节点对象
 */
function parseHysteria2URI(uri, name) {
  try {
    // 移除协议前缀
    const content = uri.substring('hysteria2://'.length);
    
    // 分离用户信息和服务器信息
    const atIndex = content.indexOf('@');
    if (atIndex === -1) return null;
    
    const auth = content.substring(0, atIndex);
    const serverPart = content.substring(atIndex + 1);
    
    // 分离服务器地址和端口
    const colonIndex = serverPart.indexOf(':');
    if (colonIndex === -1) return null;
    
    const server = serverPart.substring(0, colonIndex);
    
    // 分离端口和参数
    let port = '';
    let params = {};
    
    const questionMarkIndex = serverPart.indexOf('?', colonIndex);
    if (questionMarkIndex === -1) {
      port = serverPart.substring(colonIndex + 1);
    } else {
      port = serverPart.substring(colonIndex + 1, questionMarkIndex);
      
      // 解析参数
      const paramsStr = serverPart.substring(questionMarkIndex + 1);
      paramsStr.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value !== undefined) {
          params[key] = decodeURIComponent(value);
        }
      });
    }
    
    // 创建节点对象 - 支持更多Hysteria2参数
    return {
      name: name || `Hysteria2_${server}_${port}`,
      type: 'hysteria2',
      server: server,
      port: parseInt(port),
      password: auth,
      sni: params.sni,
      skip_cert_verify: params.insecure === '1' || params.insecure === 'true',
      alpn: params.alpn ? params.alpn.split(',') : undefined,
      obfs: params.obfs,
      "obfs-password": params["obfs-password"],
      up: params.up,
      down: params.down,
      "hop-interval": params["hop-interval"] ? parseInt(params["hop-interval"]) : undefined,
      "fast-open": true,
      udp: true
    };
  } catch (error) {
    console.warn('Hysteria2 URI解析错误:', error);
    return null;
  }
}

/**
 * 解析VMess节点URI
 * @param {string} uri VMess URI
 * @param {string} name 节点名称
 * @returns {Object} VMess节点对象
 */
function parseVmessURI(uri, name) {
  // VMess URI格式: vmess://<base64>
  const base64Content = uri.substring('vmess://'.length);
  let config;
  
  try {
    config = JSON.parse(atob(base64Content));
  } catch (e) {
    return null;
  }
  
  return {
    name: name || config.ps || `VMess_${config.add}_${config.port}`,
    type: 'vmess',
    server: config.add,
    port: parseInt(config.port),
    uuid: config.id,
    alterId: parseInt(config.aid || '0'),
    cipher: config.scy || 'auto',
    tls: config.tls === 'tls',
    'skip-cert-verify': config.verify_cert === 'false',
    network: config.net || 'tcp',
    'ws-path': config.path,
    'ws-headers': config.host ? { Host: config.host } : undefined,
    servername: config.sni
  };
}

/**
 * 解析Shadowsocks节点URI
 * @param {string} uri Shadowsocks URI
 * @param {string} name 节点名称
 * @returns {Object} Shadowsocks节点对象
 */
function parseSsURI(uri, name) {
  // SS URI格式: ss://BASE64(method:password)@server:port
  const content = uri.substring('ss://'.length);
  
  // 检查是否是新格式 (Base64 + @server:port) 还是旧格式 (全部Base64)
  let method, password, server, port;
  
  if (content.includes('@')) {
    // 新格式
    const atIndex = content.indexOf('@');
    const auth = atob(content.substring(0, atIndex));
    const serverPart = content.substring(atIndex + 1);
    
    const colonIndex = auth.indexOf(':');
    if (colonIndex === -1) return null;
    
    method = auth.substring(0, colonIndex);
    password = auth.substring(colonIndex + 1);
    
    const serverColonIndex = serverPart.indexOf(':');
    if (serverColonIndex === -1) return null;
    
    server = serverPart.substring(0, serverColonIndex);
    port = serverPart.substring(serverColonIndex + 1);
  } else {
    // 旧格式，全部Base64编码
    try {
      const decodedContent = atob(content);
      const parts = decodedContent.split('@');
      if (parts.length !== 2) return null;
      
      const authParts = parts[0].split(':');
      if (authParts.length !== 2) return null;
      
      method = authParts[0];
      password = authParts[1];
      
      const serverParts = parts[1].split(':');
      if (serverParts.length !== 2) return null;
      
      server = serverParts[0];
      port = serverParts[1];
    } catch (e) {
      return null;
    }
  }
  
  // 创建节点对象
  return {
    name: name || `SS_${server}_${port}`,
    type: 'ss',
    server: server,
    port: parseInt(port),
    cipher: method,
    password: password
  };
}

/**
 * 解析Trojan节点URI
 * @param {string} uri Trojan URI
 * @param {string} name 节点名称
 * @returns {Object} Trojan节点对象
 */
function parseTrojanURI(uri, name) {
  // Trojan URI格式: trojan://password@server:port?sni=xxx
  const content = uri.substring('trojan://'.length);
  
  // 分离密码和服务器信息
  const atIndex = content.indexOf('@');
  if (atIndex === -1) return null;
  
  const password = content.substring(0, atIndex);
  const serverPart = content.substring(atIndex + 1);
  
  // 分离服务器地址和端口
  const colonIndex = serverPart.indexOf(':');
  if (colonIndex === -1) return null;
  
  const server = serverPart.substring(0, colonIndex);
  
  // 分离端口和参数
  let port = '';
  let params = {};
  
  const questionMarkIndex = serverPart.indexOf('?', colonIndex);
  if (questionMarkIndex === -1) {
    port = serverPart.substring(colonIndex + 1);
  } else {
    port = serverPart.substring(colonIndex + 1, questionMarkIndex);
    
    // 解析参数
    const paramsStr = serverPart.substring(questionMarkIndex + 1);
    paramsStr.split('&').forEach(param => {
      const [key, value] = param.split('=');
      params[key] = value;
    });
  }
  
  // 创建节点对象
  return {
    name: name || `Trojan_${server}_${port}`,
    type: 'trojan',
    server: server,
    port: parseInt(port),
    password: password,
    sni: params.sni,
    skip_cert_verify: params.allowInsecure === '1' || params.allowInsecure === 'true'
  };
}

/**
 * 解析VLESS节点URI
 * @param {string} uri VLESS URI
 * @param {string} name 节点名称
 * @returns {Object} VLESS节点对象
 */
function parseVlessURI(uri, name) {
  try {
    // VLESS URI格式: vless://uuid@server:port?param1=value1&param2=value2#name
    const content = uri.substring('vless://'.length);
    
    // 分离uuid和服务器信息
    const atIndex = content.indexOf('@');
    if (atIndex === -1) return null;
    
    const uuid = content.substring(0, atIndex);
    const serverPart = content.substring(atIndex + 1);
    
    // 分离服务器地址和端口
    const colonIndex = serverPart.indexOf(':');
    if (colonIndex === -1) return null;
    
    const server = serverPart.substring(0, colonIndex);
    
    // 分离端口和参数
    let port = '';
    let params = {};
    
    const questionMarkIndex = serverPart.indexOf('?', colonIndex);
    if (questionMarkIndex === -1) {
      port = serverPart.substring(colonIndex + 1);
    } else {
      port = serverPart.substring(colonIndex + 1, questionMarkIndex);
      
      // 解析参数
      const paramsStr = serverPart.substring(questionMarkIndex + 1);
      paramsStr.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value !== undefined) {
          params[key] = decodeURIComponent(value);
        }
      });
    }
    
    // 创建节点对象，兼容Clash Meta格式
    const vlessNode = {
      name: name || `VLESS_${server}_${port}`,
      type: 'vless',
      server: server,
      port: parseInt(port),
      uuid: uuid,
      flow: params.flow || '',
      udp: true,
      tls: params.security === 'tls' || params.security === 'reality',
      "skip-cert-verify": params.insecure === '1' || params.allowInsecure === 'true',
      servername: params.sni || params.servername,
      network: params.type || 'tcp',
      "reality-opts": params.security === 'reality' ? {
        "public-key": params.pbk || '',
        fingerprint: params.fp || '',
        "short-id": params.sid || '',
        "spider-x": params.spx || '/'
      } : undefined
    };
    
    // 添加适当的WS选项
    if (vlessNode.network === 'ws') {
      vlessNode["ws-opts"] = {
        path: params.path || '/',
        headers: params.host ? { Host: params.host } : undefined
      };
    }
    
    // 添加适当的HTTP选项
    if (vlessNode.network === 'http') {
      vlessNode["http-opts"] = {
        path: params.path ? [params.path] : ['/'],
        headers: params.host ? { Host: [params.host] } : undefined
      };
    }
    
    // 添加适当的GRPC选项
    if (vlessNode.network === 'grpc') {
      vlessNode["grpc-opts"] = {
        "grpc-service-name": params["grpc-service-name"] || params["serviceName"] || ''
      };
    }
    
    return vlessNode;
  } catch (error) {
    console.warn('VLESS URI解析错误:', error);
    return null;
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
 * 国家/地区名称映射表
 * 每个中文名称对应其英文简称和全称（大小写不同形式）
 */
const regionMappings = {
  '香港': ['hk', 'HK', 'hongkong', 'Hongkong', 'HongKong', 'HONGKONG', 'hong kong', 'Hong Kong', 'HONG KONG'],
  '台湾': ['tw', 'TW', 'taiwan', 'Taiwan', 'TAIWAN', 'tai wan', 'Tai Wan', 'TAI WAN'],
  '日本': ['jp', 'JP', 'japan', 'Japan', 'JAPAN'],
  '韩国': ['kr', 'KR', 'korea', 'Korea', 'KOREA', 'south korea', 'South Korea', 'SOUTH KOREA'],
  '新加坡': ['sg', 'SG', 'singapore', 'Singapore', 'SINGAPORE'],
  '美国': ['us', 'US', 'usa', 'USA', 'united states', 'United States', 'UNITED STATES', 'america', 'America', 'AMERICA'],
  '英国': ['uk', 'UK', 'united kingdom', 'United Kingdom', 'UNITED KINGDOM', 'britain', 'Britain', 'BRITAIN'],
  '德国': ['de', 'DE', 'germany', 'Germany', 'GERMANY'],
  '法国': ['fr', 'FR', 'france', 'France', 'FRANCE'],
  '印度': ['in', 'IN', 'india', 'India', 'INDIA'],
  '澳大利亚': ['au', 'AU', 'australia', 'Australia', 'AUSTRALIA'],
  '加拿大': ['ca', 'CA', 'canada', 'Canada', 'CANADA'],
  '俄罗斯': ['ru', 'RU', 'russia', 'Russia', 'RUSSIA'],
  '巴西': ['br', 'BR', 'brazil', 'Brazil', 'BRAZIL'],
  '意大利': ['it', 'IT', 'italy', 'Italy', 'ITALY'],
  '荷兰': ['nl', 'NL', 'netherlands', 'Netherlands', 'NETHERLANDS'],
  '土耳其': ['tr', 'TR', 'turkey', 'Turkey', 'TURKEY'],
  '泰国': ['th', 'TH', 'thailand', 'Thailand', 'THAILAND'],
  '越南': ['vn', 'VN', 'vietnam', 'Vietnam', 'VIETNAM'],
  '马来西亚': ['my', 'MY', 'malaysia', 'Malaysia', 'MALAYSIA'],
  '菲律宾': ['ph', 'PH', 'philippines', 'Philippines', 'PHILIPPINES'],
  '印度尼西亚': ['id', 'ID', 'indonesia', 'Indonesia', 'INDONESIA'],
  '阿根廷': ['ar', 'AR', 'argentina', 'Argentina', 'ARGENTINA'],
  '瑞士': ['ch', 'CH', 'switzerland', 'Switzerland', 'SWITZERLAND'],
  '瑞典': ['se', 'SE', 'sweden', 'Sweden', 'SWEDEN'],
  '挪威': ['no', 'NO', 'norway', 'Norway', 'NORWAY'],
  '芬兰': ['fi', 'FI', 'finland', 'Finland', 'FINLAND'],
  '爱尔兰': ['ie', 'IE', 'ireland', 'Ireland', 'IRELAND'],
  '波兰': ['pl', 'PL', 'poland', 'Poland', 'POLAND'],
  '南非': ['za', 'ZA', 'south africa', 'South Africa', 'SOUTH AFRICA'],
  '墨西哥': ['mx', 'MX', 'mexico', 'Mexico', 'MEXICO'],
  '西班牙': ['es', 'ES', 'spain', 'Spain', 'SPAIN'],
  '葡萄牙': ['pt', 'PT', 'portugal', 'Portugal', 'PORTUGAL'],
  '比利时': ['be', 'BE', 'belgium', 'Belgium', 'BELGIUM'],
  '奥地利': ['at', 'AT', 'austria', 'Austria', 'AUSTRIA']
};

/**
 * 扩展区域名称过滤条件
 * @param {string} nameFilter 原始过滤条件
 * @returns {string} 扩展后的过滤条件
 */
function expandRegionNameFilter(nameFilter) {
  if (!nameFilter) return nameFilter;
  
  // 检查原始过滤条件是否包含任何映射表中的区域名称
  for (const [region, alternatives] of Object.entries(regionMappings)) {
    // 如果过滤条件精确匹配某个区域名称，则扩展为包含所有可能的形式
    if (nameFilter === region || alternatives.includes(nameFilter)) {
      // 构建一个包含所有可能形式的正则表达式
      const allForms = [region, ...alternatives];
      return `(${allForms.join('|')})`;
    }
    
    // 如果过滤条件中包含区域名称，尝试替换为更全面的形式
    if (nameFilter.includes(region)) {
      // 注意：这里我们只是简单替换，可能会导致一些边缘情况的问题
      // 如果需要更精确的替换，可能需要使用正则表达式并检查单词边界
      const regionPattern = new RegExp(region, 'g');
      const replacement = `(${region}|${alternatives.join('|')})`;
      nameFilter = nameFilter.replace(regionPattern, replacement);
    }
    
    // 检查是否包含任何替代形式
    for (const alt of alternatives) {
      if (nameFilter.includes(alt)) {
        // 在过滤条件中找到了替代形式，替换为完整的可选表达式
        const altPattern = new RegExp(alt, 'g');
        const altReplacement = `(${region}|${alternatives.join('|')})`;
        nameFilter = nameFilter.replace(altPattern, altReplacement);
        // 已经进行了替换，跳出内部循环以避免重复替换
        break;
      }
    }
  }
  
  return nameFilter;
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
  // 如果有名称过滤条件，首先扩展它以包含区域名称的各种形式
  const expandedNameFilter = nameFilter ? expandRegionNameFilter(nameFilter) : null;
  
  return proxies.filter(proxy => {
    let nameMatch = true;
    let typeMatch = true;

    if (expandedNameFilter && proxy.name) {
      try {
        const nameRegex = new RegExp(expandedNameFilter);
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

/**
 * 预处理YAML内容，处理特殊标签和格式
 * @param {string} content 原始YAML内容
 * @returns {string} 预处理后的YAML内容
 */
function preprocessYamlContent(content) {
  if (!content) return content;
  
  // 移除特殊的YAML标签，如 !<str>
  content = content.replace(/!<str>\s+/g, '');
  content = content.replace(/!\s+/g, '');  // 处理简单的 ! 标签
  content = content.replace(/!<[^>]+>\s+/g, ''); // 处理所有 !<xxx> 格式标签
  
  // 处理其他可能导致解析问题的特殊格式
  // 处理转义引号
  content = content.replace(/\\"/g, '"');
  
  return content;
}