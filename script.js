document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url');
    const nameFilterInput = document.getElementById('name-filter');
    const typeFilterInput = document.getElementById('type-filter');
    const submitBtn = document.getElementById('submit-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resultSection = document.getElementById('result');
    const originalCountElement = document.getElementById('original-count');
    const filteredCountElement = document.getElementById('filtered-count');
    const errorMessage = document.getElementById('error-message');
    const loading = document.getElementById('loading');
    const useExampleLink = document.getElementById('use-example');

    let filteredConfig = null;

    // 增加文件上传支持
    const fileUploadArea = document.createElement('div');
    fileUploadArea.className = 'form-group';
    fileUploadArea.innerHTML = `
        <p>或直接上传配置文件：</p>
        <input type="file" id="file-upload" accept=".yaml,.yml">
    `;
    urlInput.parentNode.after(fileUploadArea);

    // 使用示例配置
    useExampleLink.addEventListener('click', (e) => {
        e.preventDefault();
        urlInput.value = 'example_config.yaml';
    });

    submitBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        const nameFilter = nameFilterInput.value.trim();
        const typeFilter = typeFilterInput.value.trim();
        const fileInput = document.getElementById('file-upload');
        const file = fileInput.files.length > 0 ? fileInput.files[0] : null;

        if (!url && !file) {
            showError('请输入有效的配置文件URL或上传配置文件');
            return;
        }

        try {
            resetUI();
            showLoading(true);
            
            let yamlContent;
            if (file) {
                yamlContent = await readFileContent(file);
            } else if (url === 'example_config.yaml') {
                // 使用本地示例配置
                yamlContent = await fetch('example_config.yaml').then(res => res.text());
            } else {
                yamlContent = await fetchYamlConfig(url);
            }
            
            if (!yamlContent) {
                showError('无法获取配置文件或格式不正确');
                return;
            }

            const config = jsyaml.load(yamlContent);
            if (!config || !config.proxies || !Array.isArray(config.proxies)) {
                showError('配置文件格式不正确或不包含proxies数组');
                return;
            }

            const originalCount = config.proxies.length;
            originalCountElement.textContent = originalCount;

            // 过滤节点
            const filteredProxies = filterProxies(config.proxies, nameFilter, typeFilter);
            const filteredCount = filteredProxies.length;
            filteredCountElement.textContent = filteredCount;

            // 创建新的配置
            filteredConfig = {...config, proxies: filteredProxies};
            
            // 如果有proxy-groups，更新它们以仅包含过滤后的节点
            if (config['proxy-groups'] && Array.isArray(config['proxy-groups'])) {
                filteredConfig['proxy-groups'] = updateProxyGroups(
                    config['proxy-groups'], 
                    filteredProxies.map(p => p.name)
                );
            }

            resultSection.style.display = 'block';
            downloadBtn.disabled = false;
            
        } catch (error) {
            console.error('处理过程中出错:', error);
            showError('处理配置文件时发生错误: ' + error.message);
        } finally {
            showLoading(false);
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (!filteredConfig) return;
        
        try {
            const yamlString = jsyaml.dump(filteredConfig);
            downloadYaml(yamlString, 'filtered_config.yaml');
        } catch (error) {
            console.error('生成YAML时出错:', error);
            showError('生成YAML文件时发生错误: ' + error.message);
        }
    });

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
            showError('获取配置文件失败: ' + error.message + '。您可以尝试直接上传配置文件绕过CORS限制。');
            return null;
        }
    }

    function readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
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
                    // 如果正则表达式无效，则不过滤
                    nameMatch = true;
                }
            }

            if (typeFilter && proxy.type) {
                try {
                    const typeRegex = new RegExp(typeFilter);
                    typeMatch = typeRegex.test(proxy.type);
                } catch (error) {
                    console.warn('类型正则表达式无效:', error);
                    // 如果正则表达式无效，则不过滤
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

    function downloadYaml(yamlString, filename) {
        const blob = new Blob([yamlString], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    function showLoading(isLoading) {
        loading.style.display = isLoading ? 'block' : 'none';
        submitBtn.disabled = isLoading;
    }

    function resetUI() {
        errorMessage.style.display = 'none';
        resultSection.style.display = 'none';
        downloadBtn.disabled = true;
    }
}); 