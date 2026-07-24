# Product specification

## Objective

任意の市場・技術・地域・産業に関する問いから「何が変わるか」だけでなく、「なぜ」「どこが空白か」「誰が利益を取るか」「投資・事業として何を検証するか」を、出典まで戻れる一つの成果物として生成する。

## Implemented pipeline

| Layer | Implemented behavior | Durable artifact |
|---|---|---|
| Intake | 自由入力、意思決定、時間軸、制約 | `runs/<id>/request.json` |
| Request compiler | 地域、産業、判断タイプ、方法論、証拠規則を推定・固定 | request contract |
| Source fabric | API/MCP/手動取込/ローカルスキルを状態付きで登録 | `config/connectors.json` |
| Signal module | 既存Foresight Radarをsource map/scan/watch/diffに限定 | external skill output |
| Research runner | Codexが一次情報優先で調査、反証、現在性確認 | repo-local skill |
| Evidence ledger | URL、公開/取得日、tier、文タイプ、限界、反証 | `result.evidence[]` |
| Knowledge layer | typed nodes、polarity/weight付きedges、証拠参照 | `result.knowledge_graph` |
| Trend engine | horizon scan、STEEP、因果、S-curve、需給・ボトルネック | `megatrends[]` + methodology |
| Forecast engine | reference class、Bayesian update、確率、解像条件 | `forecasts[]` + `forecast-log.json` |
| Scenario engine | critical axes、確率、signposts、含意 | `scenarios[]` |
| Whitespace | JTBD、buyer/pain、空白理由、魅力度、実行性、次の実験 | `whitespaces[]` |
| Profit pool | value-chain stage、margin direction、capture mechanism、勝敗 | `profit_pools[]` |
| Investment | transmission、beneficiary、earnings、expectation、valuation、catalyst、crowding、downside | `investment_routes[]` |
| Business | change、pain、buyer/budget、offer、pricing、unit economics、channel、pilot/kill | `business_routes[]` |
| Optional simulation | MiroFish向けseed/graph export。戻り値はsynthetic限定 | `mirofish-input.json` |
| GUI | 12の意思決定ビュー、run履歴、待機/完了状態、接続状態 | local web app |

## Coverage packs

地域は世界、日本、北米、欧州、中国、中南米、アフリカ。産業は産業横断、製造、農業・食料、材料・鉱物、エネルギー、AI・半導体・テック、医療・バイオ、建設・不動産、モビリティ・物流、金融、循環経済を定義済み。これは地域名・産業名を並べるだけではなく、request compilerとconnector metadataで分析対象とソース候補を結び付ける。

## Method ensemble

Horizon scanning、weak signals、STEEP/PESTLE、causal systems mapping、reference-class forecasting、Bayesian updating、superforecasting、scenario planning、cross-impact、technology S-curve/TRL、learning curves、supply-demand balance、bottleneck/concentration、value-chain/profit-pool、whitespace/JTBD、real options、falsification/red-teamを定義している。実行手順と品質ゲートは `.agents/skills/run-decision-intelligence/references/analysis-protocol.md` に置く。

## State model

`pending_codex` → `researching` → `complete` または `failed`。ブラウザは固定データを完成結果として見せない。`complete` へ移れるのは、run ID、必須配列、証拠ID参照、証拠種別、予測項目を検証した結果だけ。

## Commercial hardening still required

現在は個人利用できるローカル版。第三者へ販売する前には、ユーザー認証、組織/権限、暗号化secret store、ジョブキュー、監査ログ、課金、利用規約、データライセンス確認、MCPサンドボックス、監視、バックアップ、マルチテナント分離、セキュリティレビューが必要。分析機能の設計と成果物契約は入っているが、これらを未実装のままSaaS production-readyとは呼ばない。
