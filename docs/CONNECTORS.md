# Connector guide

## 状態は証拠

- `ready`: 追加設定なしで現在利用でき、少なくとも接続経路を検証済み
- `restart_required`: 登録済みだが、このCodexセッションでは未ロード
- `degraded`: 起動または tools/list はできるが、実データ取得に失敗
- `key_required`: 情報提供元のデータキーが必要。AIモデルのAPIキーとは別
- `not_installed`: MCPまたはアダプターの導入が必要
- `manual_import`: 公式CSV/XLS/PDF等の取得・取込処理が未実装

「設定に存在する」「tools/listが成功した」「今回のrunで実データを使った」は別です。GUIは、runの証拠に `connector_id` が保存された場合だけ実使用として数えます。

## WorkbenchローカルMCP runtime

グローバルなCodex MCP登録に依存せず、`config/mcp-servers.json` と `lib/mcp-client.cjs` からstdio/Streamable HTTP MCPを呼び出せます。

```powershell
node scripts/route-mcp.cjs "日本の不動産と人口、物価、外国投資"
node -e "const {listMcpTools}=require('./lib/mcp-client.cjs'); listMcpTools('world_bank_data360_mcp').then(console.log)"
node scripts/mcp-call.cjs world_bank_data360_mcp <tool-name> --args-file .\query.json
```

現在の実動確認:

- Japan Government API MCP: 97 tools。J-STAGEの実検索成功。e-Stat、国会、法令、EDINET、地価/不動産、農業、気象等を含むが、一部ツールは個別データキーが必要
- World Bank Data360 MCP: 16 tools。GDP指標の実検索成功
- IMF Data MCP: 5 tools。Consumer Price Indexデータベースの実検索成功
- data.gouv.fr公式Remote MCP: 10 tools。不動産価格データセットの実検索成功
- 法令 / 税法 / 労務法 MCP: 3 / 7 / 6 tools
- Data.gov MCP: 4 tools
- Global Weather MCP: 6 tools
- SEC EDGAR MCP: 6 toolsの一覧取得は成功したが、実データ取得がHTTP 403のため `degraded`

## 判断領域別の主な経路

- 生活・消費・物価: IMF、World Bank Data360、Eurostat、e-Stat、日本銀行
- 不動産・土地・人口: Japan Government、data.gouv.fr、World Bank、Eurostat。MLIT詳細APIとU.S. Census MCPはデータキーが必要
- 移民・外国人・越境資金: World Bank、IMF、Eurostat、各国政府統計
- 企業の新設・倒産・承継・関係: Japan Government/gBiz/EDINET、SEC、Companies House、OpenCorporates、GLEIF。登記・倒産の一部は契約またはキーが必要
- 論文: J-STAGE/CiNii経路、Crossref、Europe PMC、Paper Search MCP。プレプリント・書誌・査読済み本文を同じ強さで扱わない

## 誠実な利用ルール

MCPの出力も自動的に一次事実にはなりません。元の統計機関、定義、対象期間、改定、地理範囲、取得日時、URLを証拠台帳へ残します。データがない場合はゼロとせず「未取得」、有料データは「競合なし」や「倒産なし」の根拠にしません。
