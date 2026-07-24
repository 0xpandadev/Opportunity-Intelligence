# Connector guide

## Status is evidence

- `ready`: 組み込みアダプタまたはローカル資産が利用可能。追加AIキーは不要。
- `key_required`: データ提供者のAPIキーが必要。AIモデルのキーとは別。
- `not_installed`: MCPや別ランタイムの登録・導入が必要。
- `manual_import`: 公式CSV/XLS/PDF等を取得し、runへ投入する。
- `unavailable`: 現環境では利用できない。

GUIはこれらを混同せず表示する。登録されているだけのMCPを「接続済み」とは表示しない。

## Built-in no-secret adapters

ローカルAPI `POST /api/connectors/<id>/query` から次を利用できる。

- `world_bank`: `{ "country":"JPN", "indicator":"NY.GDP.MKTP.CD", "start":"2015", "end":"2025" }`
- `eurostat`: `{ "dataset":"nama_10_gdp", "filters":{"geo":"DE","na_item":"B1GQ","unit":"CLV10_MEUR"} }`
- `crossref`: `{ "query":"battery recycling", "rows":10 }`
- `github_public`: `{ "query":"technology foresight", "limit":10 }`

外部ネットワーク、提供元障害、rate limitは別に発生する。レスポンスには取得時刻と実際のsource URLを含める。

## Registered source families

日本法令、税法、労務、米国法務、EDINET、SEC EDGAR、Japan Gov、e-Stat、World Bank、Eurostat、Data.gov、MLIT不動産・地理、JMA、CiNii、国会議事録、Qiita、FAOSTAT、UNIDO、USGS、Materials Project、中国NBS、CEPALSTAT、AfDB、UN SDG、Crossref、EPO、GitHub、Reddit、MiroFishを `config/connectors.json` に収録している。

MCPを実際に追加するときは、各 upstream の現行ドキュメントを確認してからCodexのMCP設定へ登録する。パッケージ名だけから起動コマンドや必要キーを推測しない。登録後に疎通確認し、該当connectorのstateを `ready` へ変更する。
