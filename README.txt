NEON PROXY 2.0 — クラウド公開版

この版はローカルサーバーを毎回起動せず、公開したURLをPC・スマホから開いて使う構成です。
初回だけVercelへのデプロイ作業が必要です。デプロイ後はスマホでも同じURLで利用できます。

【公開手順（初心者向け）】
1. https://vercel.com/ にアクセスしてアカウントを作成/ログイン
2. https://github.com/ にアクセスしてアカウントを作成/ログイン
3. このZIPを展開し、neon_proxy_cloud フォルダの中身をGitHubの新しいリポジトリにアップロード
4. Vercelで「Add New…」→「Project」を選び、そのGitHubリポジトリをImport
5. Framework PresetはOtherのまま、Deployを押す
6. デプロイ完了後に表示される https://....vercel.app がNEON PROXYのURL
7. スマホでそのURLを開く。対応ブラウザならメニューから「ホーム画面に追加」も可能

【許可ドメインの追加】
初期状態の許可先は example.com と wikipedia.org です。
自分が管理している、またはアクセス許可のあるドメインだけ追加してください。

VercelのProject Settings → Environment Variablesで次を設定:
名前: ALLOWED_HOSTS
値: example.com,wikipedia.org,mozilla.org
保存後、DeploymentsからRedeployしてください。

ドメインはカンマ区切り。例: example.com,wikipedia.org,mozilla.org
許可リストにないドメインは開けません。

【実装済み】
- PC/スマホ対応UI、青×水色ネオンデザイン
- 複数タブの追加・切替・閉じる
- タブごとの戻る/進む/更新
- ブックマークの保存・削除
- 閲覧履歴の保存・削除（最大40件）
- localStorageによる端末内保存
- PWAマニフェスト、アイコン、シェルキャッシュ
- クラウド上のHTMLプレビューAPI
- 許可ドメイン制限、リダイレクト検証、サイズ/時間制限

【重要な制限】
これは一般的なフル機能ブラウザでも、匿名化サービスでもありません。
安全性を優先し、取得したHTMLからJavaScript、フォーム、iframe、object等を取り除きます。
そのためログイン、動画サイト、地図、Webアプリ、動的サイト等は正しく動かないことがあります。
サイトの利用規約・著作権・アクセス許可を守ってください。
認証情報や個人情報を入力しないでください。
このサンプルを一般公開する場合は、利用者制限・監視・レート制限等を追加してください。
Service Workerは画面の基本ファイルをキャッシュします。プロキシで取得したページ自体はオフライン表示できません。
