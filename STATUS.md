# HABIT QUEST 技術進捗 (2026-11-22)

## 稼働・実装済み
- GitHub Pagesでアプリ公開: https://syachikulifesyachipoke-dotcom.github.io/habit-quest/
- Supabase (東京) プロジェクト `habit-quest` が稼働。組織はFreeプラン
- 習慣記録・Oura日次・ワークアウト・認証情報・OAuth状態用の5テーブル
- 本人の行に限定するRLSおよび暗号化トークンを直接公開しない設計
- Edge Function `oura-service` にOAuth PKCE / アクセストークン更新 / 部分同期 / 過去データ取込の処理を配備
- 5:40以前の起床候補、主睡眠（long_sleep）の起床時刻を採用、運動候補の確認式確定
- 過去データ候補を40件ずつ追加表示。昼寝を朝の起床として判定しない
- ゲーム上部の認証UIを右上の小型メニューに収納。画像管理・Oura表示は折りたたみ式
- メールリンク方式からメール＋パスワード認証のアプリUIへ変更。Supabase Auth SDKの`signInWithPassword`使用

## 実施した検証
- Supabase `save_habit_state` の新規保存と更新: 成功。DBのトランザクションをROLLBACKし検証用レコード0件
- RLS: 認証済み本人のデータだけに限定するポリシーを確認。匿名ユーザーの保存RPC実行は禁止
- Oura候補抽出: 05:35は対象、05:55は対象外、日次データがない日のワークアウトも対象
- 70件の模擬データ: 最初40件、追加表示で70件まで表示可能
- JavaScriptの構文検査: 通過
- 本人のOuraアカウント認可／実データ取得／トークン更新: 未検証

## 本人の操作が必要な点
1. パスワードを設定し、HABIT QUESTへログインする。詳細は [SETUP.md](./SETUP.md)
2. Oura Developerの認証情報（新しいClient Secret、暗号化キー）をSupabaseのSecretsに安全に登録・確認する
3. Ouraアカウントで同意し、最新データ・過去6か月データを実際に取得して検証する

## 料金・プライバシー
- Supabase Freeプランは変更していない。GitHubはPublicリポジトリ
- ソースに個人のOuraデータ、秘密鍵、Client Secretを埋め込まない
- Ouraの過去6か月分は現在0件（本人の認可前）
- 独自ドメイン `habit.syachiku-life.com` は未接続。既存shachipokeのDNSは変更していない

**コードを実装したことと、実際のOuraアカウントと接続できたことは区別する。**
