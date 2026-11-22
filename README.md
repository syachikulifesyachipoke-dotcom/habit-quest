# HABIT QUEST 4.0

習慣トラッカー × RPG育成 × 分析 × Oura Ring連携。個人利用向けWebアプリです。

## 現在の状態

- アプリ本体をGitHubに登録済み。GitHub Pagesの公開設定とDNS接続は未実施。
- Supabaseプロジェクト `habit-quest` (東京): [管理画面](https://supabase.com/dashboard/project/kpiqktibvzymgzwxiajv)。Freeプラン。
- DB・RLS・Oura OAuth用Edge Functionは作成済み。ただし、Oura実アカウント連携は **未検証**。
- 現在のOura Edge Functionソースは `supabase/functions/oura-service/index.ts` に保存しています。変更後はSupabase側への再デプロイが必要です。

## 公開手順

1. GitHub **Settings > Pages** を開き、**Build and deployment** を `Deploy from a branch`、`main` と `/ (root)` に設定して保存する。
2. GitHub Pagesの仮URL `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/` にアクセスし、画面が表示されるか確認する。
3. 独自ドメイン `habit.syachiku-life.com` を利用する場合、既存のDNSレコードを壊さないように、`habit` のCNAMEのみGitHub Pagesのホストへ向け、GitHub Pages側にも独自ドメインを登録する。DNS設定前に `CNAME` ファイルは登録していません。
4. Supabase **Authentication > URL Configuration** の Site URL および Redirect URLs を実際のHTTPS公開URLに設定する。本人アカウントを作成した後、新規登録を停止する。
5. Oura Developer Portalにアプリ名、公開されたWebサイト、プライバシーポリシー、利用規約、OAuth Redirect URIを入力する。
6. Supabase **Edge Function Secrets** に `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`, `OURA_TOKEN_KEY` (ランダム32バイトをBase64化), `HABIT_SITE_URL` を設定する。**秘密値をGitHubにコミットしないこと。**
7. 本人でログイン・クラウド同期・Ouraの最新7日・過去6か月取込・ログアウト・復元を実地検証する。

OuraのRedirect URI: `https://kpiqktibvzymgzwxiajv.supabase.co/functions/v1/oura-service/callback`

## 仕組み

- `index.html`: 週間トラッカー、RPG、統計、Oura操作、Supabaseログイン。
- `cloud-config.js`: **公開可能な**Supabase URL・publishable keyのみ。
- `privacy.html`, `terms.html`: Oura登録で使用する説明ページ。
- `supabase/functions/oura-service/index.ts`: Oura OAuth・同期処理。実データ接続後に追加のE2E検証が必要です。
- `images/`: 将来の共通キャラクター・背景・アイテム画像。個人画像やOuraデータは置かないこと。

## セキュリティと料金

個人の習慣記録・Ouraデータ・暗号化トークンはSupabaseに保存し、GitHubの公開リポジトリには置きません。ブラウザに置けるのはSupabaseの公開可能なキーだけです。Supabase Freeプランを維持し、有料プランへ変更しない限り、無料枠超過による自動従量課金は発生しません。ただし無料サービスの利用制限や休止は起こり得ます。JSONバックアップを定期的に取得してください。

**現時点は公開前の構築版です。** Ouraとの実接続・自動更新・スマホ同期が合格するまでは完成判定しません。
