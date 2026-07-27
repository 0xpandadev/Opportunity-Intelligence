# MCP and Data Connection Catalog

This catalog is the public portability and planning layer for Opportunity Intelligence. The executable reference manifest is [`config/mcp-servers.json`](../config/mcp-servers.json); the broader product registry is [`config/connectors.json`](../config/connectors.json). Machine-specific paths and secrets belong in ignored local configuration.

## 日本語

この一覧は「現在このPCで動くもの」だけではなく、Opportunity Intelligenceが分析テーマに応じて活用する接続候補をすべて提示します。`ready`は基準PCで接続検証済み、`degraded`は起動できるが実データ取得に問題あり、`key_required`は利用者自身のデータAPIキーが必要、`not_installed`はアダプター未導入、`manual_import`は公式ファイルやダウンロードをrunごとに取得する状態です。

APIキーはGitHubに保存しません。AIモデルのAPIキーと、e-StatやMaterials Projectなどデータ提供者のキーは別物です。cloneだけで第三者ソフトを無断導入せず、キー不要で出所を固定できるcore MCPだけを`setup-mcp.ps1`で明示導入できます。

## English

The registry intentionally lists both verified connections and planned evidence routes. Status is machine- and time-sensitive. `ready` means verified on the reference machine; `degraded` means the server starts but a live data path is impaired; `key_required` requires the user's own provider credential; `not_installed` lacks a local adapter; and `manual_import` is an official file/download workflow.

Provider credentials are never stored in Git. An AI model key is different from a data-provider key. A clone does not silently install third-party software; the explicit core setup script covers only sources with a fixed installation route and no mandatory provider key.

## 简体中文

本目录不仅列出当前电脑已验证的连接，也列出Opportunity Intelligence计划使用的全部证据路径。`ready`表示在参考电脑上已验证；`degraded`表示服务可启动但实时数据路径存在问题；`key_required`表示用户必须提供数据服务密钥；`not_installed`表示尚未安装本地适配器；`manual_import`表示按run下载和导入官方文件。

任何API密钥都不会保存到Git。AI模型密钥与数据提供商密钥是两类不同凭证。clone不会静默安装第三方软件；core脚本只处理来源和安装方式明确且不强制要求数据密钥的MCP。

## Status model

| State | Meaning |
|---|---|
| `ready` | Verified and usable on the reference environment |
| `restart_required` | Registered; Codex restart is required |
| `degraded` | Installed, but a live path currently fails or is unstable |
| `key_required` | User must provide a data-provider credential |
| `not_installed` | Candidate is documented but adapter/runtime is absent |
| `manual_import` | Official download or file import is required per analysis |
| `unavailable` | No stable supported route is currently known |

## Complete connection inventory

| ID | Provider / connection | Coverage | Transport | Reference state | Credential |
|---|---|---|---|---|---|
| `foresight_radar` | Local Foresight Radar skill | global signals, source maps | skill | ready | none |
| `world_bank` / `world_bank_data360_mcp` | World Bank Data360 | macro, development, population, climate, trade, agriculture, migration, remittances, FDI, land | REST + MCP | ready | none |
| `imf_data_mcp` | IMF SDMX data | CPI, inflation, balance of payments, exchange rates, capital flows, public finance | MCP | ready | none |
| `eurostat` | European Commission Eurostat | EU population, economy, industry, energy, agriculture, migration, housing, prices | REST | ready | none |
| `data_gouv_fr_mcp` | data.gouv.fr / Etalab | French real estate, land, housing, companies, population, geospatial data | remote MCP | ready | none |
| `datagov_mcp` | U.S. Data.gov | U.S. open data, infrastructure, climate, energy, agriculture | MCP | ready | none |
| `us_census_mcp` | U.S. Census Bureau | population, housing, commerce, industry, demographics | MCP / Docker | key_required | Census key |
| `japan_gov_mcp` | Japan Government API MCP | statistics, law, policy, companies, finance, weather, disaster, real estate, academic, agriculture | MCP | ready | some tools optional |
| `estat_mcp` | e-Stat | Japanese population, macro, census, industry | MCP | key_required | e-Stat app ID |
| `hourei_mcp` | e-Gov / hourei-mcp-server | Japanese laws and amendments | MCP | ready | none |
| `tax_law_mcp` | Japanese tax law MCP | major tax laws, notices, rulings | MCP | ready | none |
| `labor_law_mcp` | Japanese labor law MCP | labor regulation, notices, compliance | MCP | ready | none |
| `kokkai_mcp` | National Diet Library | Japanese parliamentary records | Docker MCP | not_installed | none |
| `mlit_dpf_mcp` | MLIT real-estate information | land, transactions, hazards, geospatial data | MCP | key_required | provider key |
| `jma_weather_mcp` / `weather_global_mcp` | Weather MCP + Japan government routes | global and Japanese weather, climate, logistics, agriculture | MCP | ready | none |
| `edinet_mcp` | EDINET / Dexter JP | Japanese filings, financials, valuation | MCP | not_installed | varies |
| `sec_edgar_mcp` | SEC EDGAR / sec-engine | U.S. filings, insiders, company risk | MCP | degraded | none, compliant identity required |
| `us_legal_mcp` | Congress.gov / Federal Register / CourtListener | U.S. law, regulation, courts | MCP candidate | not_installed | varies |
| `companies_house_mcp` | UK Companies House | incorporation, status, insolvency, officers, ownership, filings | MCP | key_required | Companies House key |
| `opencorporates` | OpenCorporates | global registries, relationships, officers, ownership | API / adapter | key_required | OpenCorporates key |
| `gleif` | GLEIF LEI | legal entities, direct and ultimate parents, cross-border ownership | REST / planned MCP | manual_import | none |
| `crossref` | Crossref Works | global scholarly metadata and DOI records | REST | ready | none |
| `arxiv` | arXiv | AI, technology, mathematics, materials | REST | degraded | none |
| `europe_pmc` | Europe PMC | biomedical, life-science, agriculture literature | REST | ready | none |
| `paper_search_mcp` | openags/paper-search-mcp | cross-source academic search | MCP | restart_required | none |
| `cinii_mcp` | NII CiNii | Japanese academic research | REST / MCP | key_required | NII app ID |
| `github_public` | GitHub Public Search | open-source projects and developer signals | REST | ready | none; rate limited |
| `qiita_mcp` | Qiita | Japanese developer and technology signals | MCP | key_required | Qiita token |
| `faostat` | FAO FAOSTAT | agriculture, food, land, emissions | bulk / REST | manual_import | none |
| `unido` | UNIDO Statistics | manufacturing and industry | download | manual_import | none |
| `usgs` | USGS mineral commodity data | minerals, materials, supply | download / REST | manual_import | none |
| `materials_project` | Materials Project | materials science and chemistry | REST | key_required | Materials Project key |
| `un_sdg` | United Nations SDG database | society, development, environment | download / REST | manual_import | none |
| `china_nbs` | National Bureau of Statistics of China | China macro, industry, population, agriculture | official download | manual_import | none |
| `cepalstat` | UN ECLAC CEPALSTAT | Latin America macro, society, trade, environment | download | manual_import | none |
| `afdb` | African Development Bank data | Africa macro, infrastructure, development | download | manual_import | none |
| `epo` | EPO Open Patent Services | patents and technology | REST | key_required | EPO credential |
| `reddit` | Reddit community signals | weak signals, customer pain, communities | API | key_required | Reddit credential |
| `mirofish` | 666ghj/MiroFish | separate synthetic simulation runtime | separate adapter | not_installed | runtime-dependent |

## Portable core setup

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-mcp.ps1 -Profile core
```

The core profile installs the fixed no-key local routes for Japanese law, tax law, labor law, Data.gov, weather, Japan Government API MCP, World Bank Data360, and IMF data. The script writes the machine-specific MCP root to ignored `config/mcp-servers.local.json`. It does not register secrets or accept provider terms on the user's behalf.

After installation, restart Codex and verify each server with `initialize` and `tools/list`. A successful install is not equivalent to successful live data retrieval; the first real call must still be checked and recorded in the run evidence ledger.
