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
    let yamlUrl = null;
    const urlMatch = queryString.match(/[?&]url=([^&]+)/);
    if (urlMatch && urlMatch[1]) {
      // 解码URL参数
      yamlUrl = decodeURIComponent(urlMatch[1]);
    }
    
    // 使用标准方法获取其他参数
    const nameFilter = url.searchParams.get('name');
    const typeFilter = url.searchParams.get('type');

    // 验证必要参数
    if (!yamlUrl) {
      return new Response('Error: Missing required parameter "url"', {
        status: 400,
        headers: corsHeaders
      });
    }

    try {
      // 获取 YAML 配置
      const response = await fetch(yamlUrl);
      if (!response.ok) {
        return new Response(`Error: Failed to fetch configuration: ${response.status} ${response.statusText}`, {
          status: 404,
          headers: corsHeaders
        });
      }

      const yamlContent = await response.text();
      
      // 解析 YAML
      let config;
      try {
        config = yaml.load(yamlContent);
      } catch (e) {
        return new Response(`Error: Invalid YAML format: ${e.message}`, {
          status: 400,
          headers: corsHeaders
        });
      }

      // 验证配置格式
      if (!config || !config.proxies || !Array.isArray(config.proxies)) {
        return new Response('Error: Invalid configuration format or missing proxies array', {
          status: 400,
          headers: corsHeaders
        });
      }

      // 记录原始节点数量
      const originalCount = config.proxies.length;

      // 过滤节点
      let filteredProxies = filterProxies(config.proxies, nameFilter, typeFilter);
      
      // 重命名节点
      filteredProxies = renameProxies(filteredProxies);
      
      // 记录过滤后节点数量
      const filteredCount = filteredProxies.length;
      
      // 创建新的配置
      const filteredConfig = {...config, proxies: filteredProxies};
      
      // 如果有 proxy-groups，更新它们以仅包含过滤后的节点
      if (config['proxy-groups'] && Array.isArray(config['proxy-groups'])) {
        filteredConfig['proxy-groups'] = updateProxyGroups(
          config['proxy-groups'], 
          filteredProxies.map(p => p.name)
        );
      }

      // 添加过滤信息作为注释
      const filterInfo = `# 原始节点: ${originalCount}, 过滤后节点: ${filteredCount}\n# 名称过滤: ${nameFilter || '无'}, 类型过滤: ${typeFilter || '无'}\n# 生成时间: ${new Date().toISOString()}\n`;
      
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