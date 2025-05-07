document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const yamlUrl = urlParams.get('url');
    const nameFilter = urlParams.get('name');
    const typeFilter = urlParams.get('type');
    
    if (!yamlUrl) {
        document.body.innerHTML = '缺少必要参数: url';
        return;
    }
    
    try {
        // 获取YAML内容
        const yamlContent = await fetchYamlConfig(yamlUrl);
        if (!yamlContent) {
            document.body.innerHTML = '无法获取配置文件或格式不正确';
            return;
        }

        const config = jsyaml.load(yamlContent);
        if (!config || !config.proxies || !Array.isArray(config.proxies)) {
            document.body.innerHTML = '配置文件格式不正确或不包含proxies数组';
            return;
        }

        // 过滤节点
        const filteredProxies = filterProxies(config.proxies, nameFilter, typeFilter);
        
        // 创建新的配置
        const filteredConfig = {...config, proxies: filteredProxies};
        
        // 如果有proxy-groups，更新它们以仅包含过滤后的节点
        if (config['proxy-groups'] && Array.isArray(config['proxy-groups'])) {
            filteredConfig['proxy-groups'] = updateProxyGroups(
                config['proxy-groups'], 
                filteredProxies.map(p => p.name)
            );
        }

        // 生成YAML并显示
        const yamlString = jsyaml.dump(filteredConfig);
        document.body.innerHTML = `<pre>${yamlString}</pre>`;
        
        // 尝试设置Content-Type
        document.contentType = 'application/x-yaml';
        
    } catch (error) {
        document.body.innerHTML = '处理配置文件时发生错误: ' + error.message;
    }
    
    // 复用原有的所有函数
    async function fetchYamlConfig(url) {
        try {
            // 提供多种代理选项
            const proxyOptions = [
                '', // 直接尝试（如果目标支持CORS）
                'https://cors-anywhere.herokuapp.com/',
                'https://api.allorigins.win/raw?url=',
                'https://cors-proxy.htmldriven.com/?url='
            ];

            let response = null;
            let error = null;

            // 依次尝试不同的代理
            for (const proxyUrl of proxyOptions) {
                try {
                    const fetchUrl = proxyUrl + url;
                    response = await fetch(fetchUrl);
                    if (response.ok) break;
                } catch (e) {
                    error = e;
                    console.warn(`使用代理 ${proxyUrl} 失败，尝试下一个...`);
                }
            }
            
            if (!response || !response.ok) {
                throw new Error(error || `HTTP error! status: ${response?.status}`);
            }
            
            return await response.text();
        } catch (error) {
            console.error('获取YAML配置出错:', error);
            return null;
        }
    }

    function filterProxies(proxies, nameFilter, typeFilter) {
        return proxies.filter(proxy => {
            let nameMatch = true;
            let typeMatch = true;

            if (nameFilter && proxy.name) {
                try {
                    const nameRegex = new RegExp(nameFilter);
                    nameMatch = nameRegex.test(proxy.name);
                } catch (error) {
                    console.warn('名称正则表达式无效:', error);
                    nameMatch = true;
                }
            }

            if (typeFilter && proxy.type) {
                try {
                    const typeRegex = new RegExp(typeFilter);
                    typeMatch = typeRegex.test(proxy.type);
                } catch (error) {
                    console.warn('类型正则表达式无效:', error);
                    typeMatch = true;
                }
            }

            return nameMatch && typeMatch;
        });
    }

    function updateProxyGroups(proxyGroups, validProxyNames) {
        return proxyGroups.map(group => {
            if (group.proxies && Array.isArray(group.proxies)) {
                return {
                    ...group,
                    proxies: group.proxies.filter(name => 
                        validProxyNames.includes(name) || 
                        proxyGroups.some(g => g.name === name)
                    )
                };
            }
            return group;
        });
    }
});
