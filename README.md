# ProxyFilter - Clash配置过滤器

<div align="center">
  <h3>一个功能强大的Clash代理配置过滤工具</h3>
</div>

## 中文版

### 项目简介

ProxyFilter是一款基于Cloudflare Workers的在线工具，用于动态过滤和处理Clash代理配置文件。它可以帮助您从任意Clash配置源中提取所需的节点，支持多种格式的输入（YAML、URI列表、Base64编码），并能根据名称、类型等条件进行智能过滤。

### 主要功能

- **多格式支持**：处理标准YAML配置、Base64编码内容、节点URI列表
- **智能区域过滤**：同时匹配中文名称、英文简称和全称（如"香港"、"HK"、"Hong Kong"）
- **多协议兼容**：支持VMess、Shadowsocks、Trojan、Hysteria2和VLESS等主流协议
- **代理节点去重**：自动移除重复节点，保持配置清晰
- **节点重命名**：可自定义前缀，统一节点命名格式
- **多URL合并**：支持同时处理多个配置源并合并结果
- **代理组更新**：自动更新代理选择组，保持配置可用性

### 快速开始

直接通过以下URL格式访问API：
```
https://your-worker-url.workers.dev/?url=订阅地址&name=过滤条件&type=类型过滤
```

#### 参数说明

- `url`：Clash配置URL或Base64数据，支持多个URL（逗号分隔）
- `name`：节点名称过滤条件（支持正则表达式）
- `type`：节点类型过滤条件（vmess、ss、trojan等）

#### 使用示例

1. **基本过滤**：只获取香港节点
   ```
   https://your-worker-url.workers.dev/?url=https://example.com/clash.yaml&name=香港
   ```

2. **多条件过滤**：获取所有VMess类型的香港节点
   ```
   https://your-worker-url.workers.dev/?url=https://example.com/clash.yaml&name=香港&type=vmess
   ```

3. **多源合并**：合并多个配置源并过滤
   ```
   https://your-worker-url.workers.dev/?url=https://source1.com/clash.yaml,https://source2.com/clash.yaml&name=香港
   ```

4. **直接数据输入**：处理Base64编码的URI列表
   ```
   https://your-worker-url.workers.dev/?url=data:text/plain;base64,aHlzdGVyaWEyOi8vLi4u
   ```

### 支持的协议

- VMess
- Shadowsocks (SS)
- ShadowsocksR (SSR)
- Trojan
- Hysteria2
- VLESS (含Reality支持)

### 部署方法

1. **安装Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **配置wrangler.toml**
   ```toml
   name = "clash-filter-api"
   main = "src/index.js"
   compatibility_date = "2023-05-18"

   [vars]
   DEFAULT_URL = "https://example.com/clash.yaml"
   ```

3. **部署到Cloudflare Workers**
   ```bash
   npx wrangler deploy src/index.js
   ```

### 环境变量

您可以在wrangler.toml文件中配置以下环境变量，自定义API的默认行为：

| 变量名 | 说明 | 示例 |
|-------|------|------|
| `DEFAULT_URL` | 默认的配置URL，当请求中没有提供url参数时使用 | `"https://example.com/clash.yaml"` |
| `DEFAULT_NAME_FILTER` | 默认的名称过滤条件，当请求中没有提供name参数时使用 | `"(香港|台湾)"` |
| `DEFAULT_TYPE_FILTER` | 默认的类型过滤条件，当请求中没有提供type参数时使用 | `"vmess"` |
| `FORCE_NAME_FILTER` | 强制应用的名称过滤条件，与用户提供的过滤条件同时生效 | `"^(?!.*试用)"` (排除包含"试用"字样的节点) |
| `FORCE_TYPE_FILTER` | 强制应用的类型过滤条件，与用户提供的过滤条件同时生效 | `"(vmess|trojan)"` (只保留vmess和trojan类型) |

**示例配置**：
```toml
[vars]
DEFAULT_URL = "https://source1.com/clash.yaml,https://source2.com/clash.yaml"
DEFAULT_NAME_FILTER = "香港"
FORCE_NAME_FILTER = "^(?!.*试用|.*到期)"
```

上述配置会：
- 默认合并两个订阅源
- 默认只返回香港节点
- 强制排除名称中包含"试用"或"到期"的节点，即使用户没有设置过滤条件

### 高级功能

- **智能国家/地区匹配**：支持33个主要国家/地区的多语言名称匹配
- **特殊YAML格式处理**：自动处理特殊的YAML格式和标签
- **节点URI转换**：可将URI列表自动转换为完整的Clash配置

---

## English Version

# ProxyFilter - Clash Configuration Filter

<div align="center">
  <h3>A Powerful Clash Proxy Configuration Filtering Tool</h3>
</div>

### Introduction

ProxyFilter is a Cloudflare Workers-based online tool for dynamically filtering and processing Clash proxy configuration files. It helps you extract needed nodes from any Clash configuration source, supporting various input formats (YAML, URI lists, Base64 encoded content) and intelligent filtering by name, type, and other conditions.

### Key Features

- **Multi-format Support**: Process standard YAML configurations, Base64 encoded content, and node URI lists
- **Intelligent Region Filtering**: Match Chinese names, English abbreviations, and full names simultaneously (e.g., "香港", "HK", "Hong Kong")
- **Multi-protocol Compatibility**: Support VMess, Shadowsocks, Trojan, Hysteria2, and VLESS protocols
- **Proxy Node Deduplication**: Automatically remove duplicate nodes for clean configurations
- **Node Renaming**: Customize prefixes for unified node naming
- **Multi-URL Merging**: Process and merge multiple configuration sources simultaneously
- **Proxy Group Updates**: Automatically update proxy selection groups for configuration usability

### Quick Start

Access the API directly using the following URL format:
```
https://your-worker-url.workers.dev/?url=subscription_url&name=filter_condition&type=type_filter
```

#### Parameter Description

- `url`: Clash configuration URL or Base64 data, supports multiple URLs (comma-separated)
- `name`: Node name filter condition (supports regular expressions)
- `type`: Node type filter condition (vmess, ss, trojan, etc.)

#### Usage Examples

1. **Basic Filtering**: Get only Hong Kong nodes
   ```
   https://your-worker-url.workers.dev/?url=https://example.com/clash.yaml&name=香港
   ```

2. **Multi-condition Filtering**: Get all VMess type Hong Kong nodes
   ```
   https://your-worker-url.workers.dev/?url=https://example.com/clash.yaml&name=香港&type=vmess
   ```

3. **Multi-source Merging**: Merge multiple configuration sources and filter
   ```
   https://your-worker-url.workers.dev/?url=https://source1.com/clash.yaml,https://source2.com/clash.yaml&name=香港
   ```

4. **Direct Data Input**: Process Base64 encoded URI list
   ```
   https://your-worker-url.workers.dev/?url=data:text/plain;base64,aHlzdGVyaWEyOi8vLi4u
   ```

### Supported Protocols

- VMess
- Shadowsocks (SS)
- ShadowsocksR (SSR)
- Trojan
- Hysteria2
- VLESS (with Reality support)

### Deployment Method

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Configure wrangler.toml**
   ```toml
   name = "clash-filter-api"
   main = "src/index.js"
   compatibility_date = "2023-05-18"

   [vars]
   DEFAULT_URL = "https://example.com/clash.yaml"
   ```

3. **Deploy to Cloudflare Workers**
   ```bash
   npx wrangler deploy src/index.js
   ```

### Environment Variables

You can configure the following environment variables in your wrangler.toml file to customize the default behavior of the API:

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `DEFAULT_URL` | Default configuration URL used when no url parameter is provided in the request | `"https://example.com/clash.yaml"` |
| `DEFAULT_NAME_FILTER` | Default name filter applied when no name parameter is provided | `"(hongkong|taiwan)"` |
| `DEFAULT_TYPE_FILTER` | Default type filter applied when no type parameter is provided | `"vmess"` |
| `FORCE_NAME_FILTER` | Enforced name filter that is applied alongside user-provided filters | `"^(?!.*trial)"` (exclude nodes containing "trial") |
| `FORCE_TYPE_FILTER` | Enforced type filter that is applied alongside user-provided filters | `"(vmess|trojan)"` (keep only vmess and trojan types) |

**Example Configuration**:
```toml
[vars]
DEFAULT_URL = "https://source1.com/clash.yaml,https://source2.com/clash.yaml"
DEFAULT_NAME_FILTER = "hongkong"
FORCE_NAME_FILTER = "^(?!.*trial|.*expired)"
```

This configuration will:
- Merge two subscription sources by default
- Only return Hong Kong nodes by default
- Always exclude nodes containing "trial" or "expired" in their names, even if the user doesn't set a filter

### Advanced Features

- **Smart Country/Region Matching**: Support multilingual name matching for 33 major countries/regions
- **Special YAML Format Handling**: Automatically process special YAML formats and tags
- **Node URI Conversion**: Automatically convert URI lists to complete Clash configurations 