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
    let templateUrl = url.searchParams.get('template'); // 模板配置URL参数
    let templateContent = url.searchParams.get('template_content'); // 新增: 直接传递的模板内容
    let serverFilter = url.searchParams.get('server'); // 新增: 服务器类型过滤参数(domain或ip)
    
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

    if (!templateUrl && env.DEFAULT_TEMPLATE_URL) {
      templateUrl = env.DEFAULT_TEMPLATE_URL;
    }

    if (!serverFilter && env.DEFAULT_SERVER_FILTER) {
      serverFilter = env.DEFAULT_SERVER_FILTER;
    }
    
    // 强制应用环境变量中的过滤器（如果存在）
    // 这些过滤器会与用户提供的过滤器一起应用
    const forceNameFilter = env.FORCE_NAME_FILTER;
    const forceTypeFilter = env.FORCE_TYPE_FILTER;
    const forceServerFilter = env.FORCE_SERVER_FILTER; // 新增: 强制服务器类型过滤

    // 验证必要参数
    if (!yamlUrlParam) {
      return new Response('Error: Missing required parameter "url" or DEFAULT_URL environment variable', {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8'
        }
      });
    }
    
    // 分割多URL参数（用逗号分隔）
    const yamlUrls = yamlUrlParam.split(',').map(u => u.trim()).filter(u => u);
    
    // 限制URL数量，避免过多处理
    if (yamlUrls.length > 100) {
      return new Response('Error: Too many URLs provided (maximum 100 allowed)', {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8'
        }
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
              headers: {
                ...corsHeaders,
                'Content-Type': 'text/plain; charset=utf-8'
              }
            });
          }
        }
      }
      
      // 验证是否有有效的配置
      if (!firstConfig) {
        return new Response('Error: No valid configuration found from the provided URLs', {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain; charset=utf-8'
          }
        });
      }

      // 验证是否有代理节点
      if (mergedProxies.length === 0) {
        return new Response('Error: No proxies found in the configurations', {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/plain; charset=utf-8'
          }
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
      const effectiveServerFilter = combineFilters(serverFilter, forceServerFilter);
      
      // 过滤节点
      let filteredProxies = filterProxies(
        mergedProxies, 
        effectiveNameFilter, 
        effectiveTypeFilter,
        effectiveServerFilter
      );
      
      // 重命名节点，使用名称过滤条件
      filteredProxies = renameProxies(filteredProxies, nameFilter);
      
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
      let filterInfo = `# 原始节点总计: ${totalOriginalCount}, 去重后: ${afterDedupeCount} (移除了${duplicateCount}个重复节点), 过滤后节点: ${filteredCount}\n` +
                       `# 名称过滤: ${nameFilter || '无'} ${forceNameFilter ? '(强制: ' + forceNameFilter + ')' : ''}\n` +
                       `# 类型过滤: ${typeFilter || '无'} ${forceTypeFilter ? '(强制: ' + forceTypeFilter + ')' : ''}\n` +
                       `# 服务器类型过滤: ${serverFilter || '无'} ${forceServerFilter ? '(强制: ' + forceServerFilter + ')' : ''}\n` +
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
      // 增加详细的错误日志
      console.error(`处理错误: ${error.message}`, error.stack);
      
      // 返回更详细的错误信息
      const errorMessage = `Error: ${error.message}\n\nStack: ${error.stack || 'No stack trace'}\n`;
      return new Response(errorMessage, {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8'
        }
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
    
    // 特殊处理：检查URL是否是已知的V2Ray格式订阅
    if (yamlUrl.includes('githubusercontent.com') && 
        (yamlUrl.includes('/v2rayfree/') || 
         yamlUrl.includes('/aiboboxx/') || 
         yamlUrl.includes('/freefq/'))) {
      console.log("检测到已知的V2Ray订阅格式，使用特殊处理");
      
      // 这些订阅通常是单行Base64编码的SS/V2Ray节点
      if (content && content.trim() && /^[A-Za-z0-9+/=\s]+$/.test(content.trim())) {
        try {
          const decodedContent = atob(content.replace(/\s/g, ''));
          if (decodedContent.includes('ss://') || 
              decodedContent.includes('vmess://') || 
              decodedContent.includes('trojan://')) {
            
            // 解码成功，尝试解析节点
            const nodeConfig = parseURIListToConfig(decodedContent);
            if (nodeConfig && nodeConfig.proxies && nodeConfig.proxies.length > 0) {
              return { config: nodeConfig };
            } else {
              return { error: `解析到${decodedContent.split(/\r?\n/).filter(Boolean).length}行内容，但未能提取有效节点` };
            }
          }
        } catch (e) {
          return { error: `解析V2Ray订阅格式失败: ${e.message}` };
        }
      }
    }
    
    // 预处理YAML内容，移除特殊标签
    content = preprocessYamlContent(content);
    
    // 特别检查: 如果内容是纯单行的Base64编码文本，尝试直接处理
    if (content.trim().split(/\r?\n/).length === 1 && content.length > 100 && /^[A-Za-z0-9+/=\s]+$/.test(content)) {
      try {
        console.log("检测到单行可能的Base64内容，尝试直接解码");
        const cleanContent = content.replace(/\s/g, '');
        const decodedContent = atob(cleanContent);
        
        // 如果解码后的内容包含节点URI特征，直接作为节点列表处理
        if (decodedContent.includes('ss://') || 
            decodedContent.includes('vmess://') || 
            decodedContent.includes('trojan://')) {
          
          console.log("解码后内容为节点列表，尝试直接解析");
          try {
            const nodeConfig = parseURIListToConfig(decodedContent);
            if (nodeConfig && nodeConfig.proxies && nodeConfig.proxies.length > 0) {
              return { config: nodeConfig };
            }
          } catch (nodeParseError) {
            console.warn("节点列表解析失败:", nodeParseError.message);
          }
        }
      } catch (err) {
        console.warn("单行Base64直接解码失败:", err.message);
        // 如果直接处理失败，继续使用标准流程
      }
    }
    
    // 检查内容是否为Base64编码
    const isBase64Content = isBase64(content);
    let originalContent = content;
    
    if (isBase64Content) {
      try {
        // 尝试解码Base64内容
        console.log("检测到Base64编码内容，尝试解码");
        const decodedContent = atob(content.replace(/\s/g, ''));
        content = decodedContent;
        
        // 解码后再次预处理
        content = preprocessYamlContent(content);
        
        // 检查解码后的内容是否仍然是Base64（有时订阅可能被多次编码）
        if (content.length > 20 && isBase64(content)) {
          try {
            console.log("检测到多重Base64编码，尝试二次解码");
            const secondDecodedContent = atob(content.replace(/\s/g, ''));
            content = preprocessYamlContent(secondDecodedContent);
          } catch (secondDecodeError) {
            console.warn("二次Base64解码失败", secondDecodeError);
            // 如果二次解码失败，保持使用第一次解码的结果
          }
        }
      } catch (decodeError) {
        console.warn("Base64解码失败", decodeError);
        // 如果解码失败，继续使用原始内容
        content = originalContent;
      }
    }
    
    // 使用日志记录内容的前100个字符，帮助调试
    console.log("解析内容前100个字符:", content.substring(0, 100));
    
    // 直接检查解码后的内容是否包含节点URI
    const hasNodeURIs = checkForNodeURIs(content);
    if (hasNodeURIs) {
      try {
        console.log("检测到节点URI列表，尝试解析");
        const nodeConfig = parseURIListToConfig(content);
        if (nodeConfig && nodeConfig.proxies && nodeConfig.proxies.length > 0) {
          return { config: nodeConfig };
        }
      } catch (nodeError) {
        console.warn("节点列表解析失败:", nodeError.message);
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
      // YAML解析失败，继续下一步尝试
      console.warn("YAML解析失败:", error.message);
    }
    
    // 所有解析方法都失败，如果内容已被解码，尝试以原始内容再解析一次
    if (isBase64Content && originalContent !== content) {
      try {
        // 尝试解析原始内容
        console.log("原始内容再次尝试解析");
        const originalConfig = yaml.load(originalContent);
        if (originalConfig && typeof originalConfig === 'object') {
          if (originalConfig.proxies && Array.isArray(originalConfig.proxies) && originalConfig.proxies.length > 0) {
            return { config: originalConfig };
          }
          
          if (Object.keys(originalConfig).length > 0) {
            originalConfig.proxies = originalConfig.proxies || [];
            return { config: originalConfig };
          }
        }
      } catch (origError) {
        console.warn("原始内容解析尝试失败:", origError.message);
      }
    }
    
    // 所有解析方法都失败
    if (isBase64Content) {
      // 如果是Base64内容解析失败，提供更具体的错误
      return {
        error: `Base64内容解码后解析失败: ${yamlError ? yamlError.message : '无法识别的格式'}`
      };
    } else {
      return {
        error: yamlError 
          ? `YAML解析错误: ${yamlError.message}` 
          : "无效的配置格式或无法识别的节点格式"
      };
    }
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
  
  // 将内容分成行并过滤空行
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  
  // 协议前缀列表
  const protocolPrefixes = ['vmess://', 'ss://', 'ssr://', 'trojan://', 'hysteria2://', 'vless://', 'http://', 'https://'];
  
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
  
  // 提高识别准确性：
  // 1. 如果有很多行，且有效URI占多数（>20%），明显是节点列表
  // 2. 如果行数少，只要有1个以上的有效URI，也可能是节点列表
  // 3. 如果只有一行但包含多个URI，可能是连续的URI列表
  const isMultilineNodeList = 
    (totalLines >= 5 && validUriCount / totalLines > 0.2) || 
    (totalLines < 5 && validUriCount > 0) ||
    (totalLines === 1 && content.includes('ss://') && content.length > 100);
  
  // 判断是否为单纯的节点URI列表（非YAML文档）
  const isNodeUriList = isMultilineNodeList && !content.includes('proxies:') && !content.includes('rules:');
  
  return isNodeUriList;
}

/**
 * 检查字符串是否为Base64编码
 * @param {string} str 要检查的字符串
 * @returns {boolean} 是否为Base64编码
 */
function isBase64(str) {
  if (!str || typeof str !== 'string') return false;
  
  // 清理内容 - 移除所有空白字符
  const cleanStr = str.replace(/\s/g, '');
  
  // 忽略过短的内容
  if (cleanStr.length < 20) return false;
  
  // 特殊检测: 单行长字符串且只包含Base64字符集，很可能是Base64编码的节点列表
  // (例如: https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2)
  const isSingleLine = str.trim().split(/\r?\n/).length <= 3; // 允许最多3行（包括可能的空行）
  if (isSingleLine && cleanStr.length > 100) {
    const base64OnlyRegex = /^[A-Za-z0-9+/=]+$/;
    if (base64OnlyRegex.test(cleanStr)) {
      try {
        // 尝试解码一小部分
        const testDecode = atob(cleanStr.substring(0, Math.min(cleanStr.length, 1000)));
        // 检查解码内容是否包含节点URI特征
        if (testDecode.includes('ss://') || 
            testDecode.includes('vmess://') || 
            testDecode.includes('trojan://')) {
          // 高度可能是节点列表的Base64编码
          return true;
        }
      } catch (e) {
        // 解码测试失败，可能不是Base64
      }
    }
  }
  
  // 1. 标准格式检查: 只允许Base64字符集
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(cleanStr)) {
    return false;
  }
  
  // 2. 长度验证: Base64编码的字符串长度应该是4的倍数(可能有填充)
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
    
    // 4. 判断是否为二进制数据
    const binaryTest = /[\x00-\x08\x0E-\x1F]/.test(decoded);
    if (binaryTest) {
      // 二进制数据不太可能是我们想要的配置文件
      return false;
    }
    
    // 5. 检查解码后是否包含YAML或节点特征
    // YAML特征
    if (decoded.includes('proxies:') || 
        decoded.includes('mixed-port:') || 
        decoded.includes('port:') ||
        decoded.includes('proxy-groups:') ||
        decoded.includes('rules:')) {
      return true;  // 这是Base64编码的YAML，应该解码
    }
    
    // 节点URI特征
    if (decoded.includes('vmess://') || 
        decoded.includes('ss://') || 
        decoded.includes('trojan://') ||
        decoded.includes('vless://') || 
        decoded.includes('hysteria2://')) {
      return true; // 这是Base64编码的节点列表，应该解码
    }
    
    // 6. 计算文本内容比例
    const textChars = decoded.split('').filter(c => {
      const code = c.charCodeAt(0);
      return code >= 32 && code <= 126; // ASCII可打印字符范围
    }).length;
    
    const textRatio = textChars / decoded.length;
    
    // 如果解码后文本比例高，并且内容中包含常见的配置关键词
    if (textRatio > 0.9) {
      if (decoded.includes('name:') && 
          (decoded.includes('server:') || decoded.includes('port:') || decoded.includes('type:'))) {
        return true; // 可能是配置文件
      }
      
      // 检查是否有多行内容，可能是代理列表
      const lines = decoded.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length > 2) {
        return true;
      }
    }
    
    // 默认情况下，如果不能确定，返回false
    return false;
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
  let parseFailures = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 跳过注释行和空行
    if (line.startsWith('#') || line.length === 0) {
      continue;
    }
    
    // 对于非URI开头的行进行跳过
    if (!line.startsWith('ss://') && 
        !line.startsWith('ssr://') && 
        !line.startsWith('vmess://') && 
        !line.startsWith('trojan://') && 
        !line.startsWith('vless://') && 
        !line.startsWith('hysteria2://')) {
      continue;
    }
    
    const proxy = parseURI(line);
    
    if (proxy) {
      proxies.push(proxy);
    } else {
      parseFailures++;
      console.warn(`解析失败: 第${i+1}行: ${line.substring(0, 30)}...`);
    }
  }
  
  if (proxies.length === 0) {
    // 如果所有节点都解析失败，记录统计信息帮助调试
    console.warn(`节点解析统计: 总行数=${lines.length}, 解析失败数=${parseFailures}`);
    return null;
  }
  
  console.log(`成功解析节点: ${proxies.length}个, 失败: ${parseFailures}个`);
  
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
      },
      {
        name: '自动选择',
        type: 'url-test',
        url: 'http://www.gstatic.com/generate_204',
        interval: 300,
        tolerance: 50,
        proxies: [...proxies.map(p => p.name)]
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
 * 判断字符串是否为IP地址
 * @param {string} str 要检查的字符串
 * @returns {boolean} 是否为IP地址
 */
function isIPAddress(str) {
  if (!str) return false;
  
  // IPv4地址格式检查
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = str.match(ipv4Pattern);
  
  if (!match) return false;
  
  // 验证每个部分是否在0-255范围内
  for (let i = 1; i <= 4; i++) {
    const part = parseInt(match[i]);
    if (part < 0 || part > 255) {
      return false;
    }
  }
  
  return true;
}

/**
 * 判断字符串是否为域名
 * @param {string} str 要检查的字符串
 * @returns {boolean} 是否为域名
 */
function isDomainName(str) {
  if (!str) return false;
  
  // 如果是IP，则不是域名
  if (isIPAddress(str)) return false;
  
  // 以下是一些常见的非域名服务器地址
  if (str === 'localhost' || str.startsWith('127.') || str === '0.0.0.0') {
    return false;
  }
  
  // 多级检查 - 先用宽松规则，再用严格规则
  
  // 1. 基本检查: 域名需要至少包含一个点，并且没有空格和特殊字符
  if (!str.includes('.') || /\s/.test(str)) {
    return false;
  }
  
  // 2. 宽松检查: 域名格式检查(包括国际化域名支持)
  // 这个正则表达式比较宽松，允许大多数合法域名格式
  const looseDomainPattern = /^([a-zA-Z0-9_]([a-zA-Z0-9\-_]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9\-]{1,}$/;
  
  // 3. 特殊情况: 某些特殊的二级域名格式可能不符合严格规则
  // 例如: 以数字结尾的域名 (example.123)、非标准顶级域名等
  // 如果域名长度适中且至少包含一个点，而且不含空格或奇怪字符，很可能是域名
  const isPotentialDomain = str.length > 3 && str.length < 255 && 
                          str.includes('.') && 
                          !/[\s,!@#$%^&*()+={}\[\]:;"'<>?\/\\|]/.test(str);
  
  // 返回检查结果: 如果通过宽松规则，或者看起来很像域名，则认为是域名
  return looseDomainPattern.test(str) || isPotentialDomain;
}

/**
 * 过滤代理节点
 */
function filterProxies(proxies, nameFilter, typeFilter, serverFilter) {
  // 如果有名称过滤条件，首先扩展它以包含区域名称的各种形式
  const expandedNameFilter = nameFilter ? expandRegionNameFilter(nameFilter) : null;
  
  return proxies.filter(proxy => {
    let nameMatch = true;
    let typeMatch = true;
    let serverMatch = true;

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

    if (serverFilter && proxy.server) {
      // 特殊处理'domain'和'ip'关键词
      if (serverFilter === 'domain') {
        serverMatch = isDomainName(proxy.server);
      } else if (serverFilter === 'ip') {
        serverMatch = isIPAddress(proxy.server);
      } else {
        try {
          // 对于其他值，使用正则表达式匹配
          const serverRegex = new RegExp(serverFilter);
          serverMatch = serverRegex.test(proxy.server);
        } catch (error) {
          console.warn('Invalid server regex:', error);
          serverMatch = true;
        }
      }
    }

    return nameMatch && typeMatch && serverMatch;
  });
}

/**
 * 重命名代理节点
 * 如果提供了固定前缀，则使用该前缀统一命名所有节点
 * 否则，按原规则：用"_"分割原始名称并取第一个
 * @param {Array} proxies 要重命名的代理节点数组
 * @param {string} nameFilter 名称过滤条件，可能包含多个区域条件
 * @returns {Array} 重命名后的节点数组
 */
function renameProxies(proxies, nameFilter) {
  // 无论是否有过滤条件，都尝试识别节点的区域并进行分组
  // 1. 根据节点名自动识别区域
  const proxyWithRegion = proxies.map(proxy => {
    const nodeName = proxy.name || '';
    let region = '';
    
    // 尝试从节点名中识别区域
    for (const [regionName, alternatives] of Object.entries(regionMappings)) {
      if (nodeName.toLowerCase().includes(regionName.toLowerCase())) {
        region = regionName;
        break;
      }
      
      // 检查备选形式
      const found = alternatives.some(alt => 
        nodeName.toLowerCase().includes(alt.toLowerCase())
      );
      
      if (found) {
        region = regionName;
        break;
      }
    }
    
    // 如果识别不到区域，提取名称前缀或使用默认值
    if (!region) {
      // 尝试从服务器地址判断区域（对特定IP段）
      if (proxy.server) {
        region = guessRegionFromServer(proxy.server);
      }
      
      // 如果仍然无法判断，提取名称前缀或使用默认值
      if (!region) {
        const parts = nodeName.split(/[\s_\-+|:：]/);
        region = parts[0] || "节点";
      }
    }
    
    return { ...proxy, region };
  });
  
  // 2. 按区域分组并计数
  const regionCounts = {};
  
  // 如果有过滤条件，使用条件中的区域，否则使用自动识别的区域
  if (nameFilter) {
    // 已有过滤条件的处理逻辑 - 解析过滤条件中的区域
    const regionConditions = parseRegionConditions(nameFilter);
    
    return proxyWithRegion.map(proxy => {
      // 确定节点匹配的区域
      const matchedRegion = determineMatchedRegion(proxy.name, regionConditions);
      
      // 更新该区域的计数
      regionCounts[matchedRegion] = (regionCounts[matchedRegion] || 0) + 1;
      
      // 创建新名称，使用匹配的区域名称
      const newName = `${matchedRegion}_${regionCounts[matchedRegion]}`;
      
      // 返回带有新名称的代理节点
      return {
        ...proxy,
        name: newName
      };
    });
  } else {
    // 没有过滤条件时的改进处理逻辑
    // 排序顺序: 1. 按区域分组 2. 同一区域内可选按类型次要排序
    proxyWithRegion.sort((a, b) => {
      if (a.region !== b.region) {
        return a.region.localeCompare(b.region);
      }
      // 次要排序: 按类型
      return (a.type || '').localeCompare(b.type || '');
    });
    
    // 按区域重命名
    return proxyWithRegion.map(proxy => {
      // 更新该区域的计数
      regionCounts[proxy.region] = (regionCounts[proxy.region] || 0) + 1;
      
      // 规范化区域名称 - 使用中文区域名称或原始区域标识
      const displayRegion = proxy.region;
      
      // 创建新名称
      const newName = `${displayRegion}_${regionCounts[proxy.region]}`;
      
      // 返回带有新名称的代理节点
      return {
        ...proxy,
        name: newName
      };
    });
  }
}

/**
 * 根据服务器IP地址猜测区域
 * @param {string} server 服务器地址
 * @returns {string} 猜测的区域名称，无法判断时返回空字符串
 */
function guessRegionFromServer(server) {
  // 简单的IP判断逻辑
  // 注意: 这只是一个基础实现，实际IP地理位置需要更完整的数据库
  
  // 检查是否为IP地址 (简单判断)
  const isIP = isIPAddress(server);
  if (!isIP) {
    // 判断域名后缀
    if (server.endsWith('.jp') || server.includes('japan') || server.includes('jp')) {
      return '日本';
    } else if (server.endsWith('.hk') || server.includes('hongkong') || server.includes('hk')) {
      return '香港';
    } else if (server.endsWith('.sg') || server.includes('singapore') || server.includes('sg')) {
      return '新加坡';
    } else if (server.endsWith('.tw') || server.includes('taiwan') || server.includes('tw')) {
      return '台湾';
    } else if (server.endsWith('.us') || server.includes('america') || server.includes('us')) {
      return '美国';
    } else if (server.endsWith('.kr') || server.includes('korea') || server.includes('kr')) {
      return '韩国';
    } else if (server.endsWith('.uk') || server.includes('united.kingdom')) {
      return '英国';
    } else if (server.endsWith('.de') || server.includes('germany')) {
      return '德国';
    } else if (server.endsWith('.fr') || server.includes('france')) {
      return '法国';
    } else if (server.endsWith('.ca') || server.includes('canada')) {
      return '加拿大';
    }
    
    return '';
  }
  
  // 将IP转换为数字数组
  const ipParts = server.split('.').map(part => parseInt(part, 10));
  
  // 检查一些已知的IP范围
  // 这只是示例，实际应使用完整的IP地理位置数据库
  if (ipParts[0] === 13 || ipParts[0] === 14) {
    return '美国'; // 示例: 13.x.x.x 和 14.x.x.x 可能是美国IP
  } else if (ipParts[0] === 103 && ipParts[1] >= 100 && ipParts[1] <= 110) {
    return '新加坡'; // 示例: 103.10x.x.x 可能是新加坡IP
  } else if (ipParts[0] === 101 && ipParts[1] >= 32 && ipParts[1] <= 36) {
    return '日本'; // 示例: 101.3x.x.x 可能是日本IP
  } else if ((ipParts[0] === 219 || ipParts[0] === 220) && ipParts[1] >= 68 && ipParts[1] <= 88) {
    return '香港'; // 示例: 219.7x.x.x 可能是香港IP
  } else if (ipParts[0] === 182 && ipParts[1] >= 230 && ipParts[1] <= 250) {
    return '台湾'; // 示例: 182.24x.x.x 可能是台湾IP
  }
  
  return '';
}

/**
 * 解析过滤条件中包含的区域名称
 * @param {string} nameFilter 名称过滤条件
 * @returns {Array} 包含区域名称和备选形式的数组
 */
function parseRegionConditions(nameFilter) {
  if (!nameFilter) return [];
  
  // 尝试提取过滤条件中的区域名称
  const conditions = [];
  
  // 首先检查是否是简单的或条件，如 "jp|sg|kr|台湾"
  const orParts = nameFilter.split('|');
  if (orParts.length > 1) {
    for (const part of orParts) {
      const trimmedPart = part.trim();
      // 检查是否是已知的区域名称或其备选形式
      const matchedRegion = getRegionByNameOrAlternative(trimmedPart);
      if (matchedRegion) {
        conditions.push(matchedRegion);
      } else {
        conditions.push({
          name: trimmedPart,
          alternatives: []
        });
      }
    }
  } else {
    // 如果不是简单的或条件，尝试其他模式，如 "(香港|日本)"
    const bracketsMatch = nameFilter.match(/\((.*?)\)/);
    if (bracketsMatch && bracketsMatch[1]) {
      const innerParts = bracketsMatch[1].split('|');
      for (const part of innerParts) {
        const trimmedPart = part.trim();
        const matchedRegion = getRegionByNameOrAlternative(trimmedPart);
        if (matchedRegion) {
          conditions.push(matchedRegion);
        } else {
          conditions.push({
            name: trimmedPart,
            alternatives: []
          });
        }
      }
    } else {
      // 如果是单一条件，直接检查
      const matchedRegion = getRegionByNameOrAlternative(nameFilter.trim());
      if (matchedRegion) {
        conditions.push(matchedRegion);
      } else {
        conditions.push({
          name: nameFilter.trim(),
          alternatives: []
        });
      }
    }
  }
  
  return conditions;
}

/**
 * 根据名称或备选形式获取区域信息
 * @param {string} nameOrAlt 区域名称或备选形式
 * @returns {Object|null} 包含区域名称和备选形式的对象，未找到返回null
 */
function getRegionByNameOrAlternative(nameOrAlt) {
  // 检查是否完全匹配某个区域名称
  if (regionMappings[nameOrAlt]) {
    return {
      name: nameOrAlt,
      alternatives: regionMappings[nameOrAlt]
    };
  }
  
  // 检查是否匹配某个区域的备选形式
  for (const [region, alternatives] of Object.entries(regionMappings)) {
    if (alternatives.includes(nameOrAlt)) {
      return {
        name: region,
        alternatives: alternatives
      };
    }
  }
  
  return null;
}

/**
 * 确定节点名称匹配的区域
 * @param {string} nodeName 节点名称
 * @param {Array} regionConditions 区域条件数组
 * @returns {string} 匹配的区域名称，未匹配到返回"node"
 */
function determineMatchedRegion(nodeName, regionConditions) {
  if (!nodeName || !regionConditions || regionConditions.length === 0) {
    return "node";
  }
  
  // 检查节点名称是否匹配任何区域名称或其备选形式
  for (const region of regionConditions) {
    // 首先检查区域名称
    if (nodeName.toLowerCase().includes(region.name.toLowerCase())) {
      return region.name;
    }
    
    // 然后检查备选形式
    for (const alt of region.alternatives) {
      if (nodeName.toLowerCase().includes(alt.toLowerCase())) {
        return region.name;  // 返回中文区域名称
      }
    }
  }
  
  // 未匹配到任何区域，使用第一个条件的名称，或默认值"node"
  return regionConditions.length > 0 ? regionConditions[0].name : "node";
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