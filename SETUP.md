# HABIT QUEST 初回ログイン・Oura接続手順

最終更新：2026-11-22。GitHub Pages版の初回利用向け。アプリの実ログイン/Oura認可はユーザー本人のみ操作できます。

## 1. Supabase AuthのURLを設定

[Supabase Authentication > URL Configuration](https://supabase.com/dashboard/project/kpiqktibvzymgzwxiajv/auth/url-configuration) で：

- **Site URL**: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/`
- **Redirect URLs**: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/` を追加

保存後、[HABIT QUEST](https://syachikulifesyachipoke-dotcom.github.io/habit-quest/) の「クラウド保存・端末同期」から自身のメールアドレスを入力し「ログインメールを送信」。届いたメールのリンクを開いてログインします。初回には「この端末の記録をクラウドに保存」等を選択します。誤上書き前にJSONバックアップを取ります。

## 2. Oura Developer Portalでアプリ作成

[Oura Applications](https://developer.ouraring.com/applications) の Create Newで以下を登録。既存の独自ドメインが未設定の間は、現在動くGitHub PagesのURLで登録します。

- Display Name: `HABIT QUEST`
- Description: `Personal habit tracker with Oura sleep, activity and workout insights`
- Website: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/`
- Privacy Policy: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/privacy.html`
- Terms of Service: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/terms.html`
- **Redirect URI**: `https://kpiqktibvzymgzwxiajv.supabase.co/functions/v1/oura-service/callback`
- Contact Email: 本人が実際に受信できるアドレス

Client ID / Client Secretは**GitHub・公開HTML・チャットへ貼り付けない**こと。SupabaseのSecretsにのみ保存します。

## 3. Supabase Edge Function SecretsにOura認証情報を登録

[Secrets管理画面](https://supabase.com/dashboard/project/kpiqktibvzymgzwxiajv/functions/secrets) でKeyとValueを登録します。

| Key | Value |
| --- | --- |
| `OURA_CLIENT_ID` | Ouraで発行したClient ID |
| `OURA_CLIENT_SECRET` | Ouraで発行したClient Secret |
| `OURA_TOKEN_KEY` | 安全な乱数32バイトをBase64化した値 |
| `HABIT_SITE_URL` | `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/` |

Windows PowerShellを使っている場合、**自分のPC上で**以下を実行して暗号化用キーを生成します（生成結果はチャット・GitHubに貼らない）：

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes)
$rng.Dispose()
```

**注意:** Supabase側のシークレット管理では、トークンを保存する関数がすでに配備されています。シークレットがそろうまで「Ouraアカウント連携」は無効です。

## 4. Oura接続と同期の確認

- HABIT QUESTを開いてメールリンクでログイン。
- 「Ouraアカウント連携」ボタンを押し、Oura上で権限 `daily` と `workout` を承認。
- アプリに戻ったら「直近7日同期」で最新データを検証。
- 「過去6か月取込」で過去の記録を取得。Oura側に記録がある期間のみ取得可能。
- 起床の候補は睡眠終了時刻に基づく推定、筋トレは運動履歴であり、自動的に習慣の「達成」へ確定はしません。
- 初回以降はアプリを開いたとき、また画面を再表示したときに前回試行から6時間以上なら同期を試みます。アプリを閉じている間の常時同期ではありません。

## 5. 将来の独自ドメイン設定

`habit.syachiku-life.com` のDNSを正しく設定しGitHub PagesでHTTPS公開できた後、SupabaseのSite URL/Redirect URLs、Edge Function Secretの `HABIT_SITE_URL`、OuraのWebsite等を順に切り替えます。現在の段階ではDNSやネームサーバーを変更しないでください。

## 6. 受入基準

1. ブラウザからHABIT QUESTにアクセスできる
2. メールログインできる
3. チェック記録がSupabaseに保存され別端末にも同期する
4. Oura OAuth認可に成功する
5. 実測日次データ・ワークアウト履歴を取得できる
6. 過去6か月の履歴を取得できる（Ouraに記録がある日）
7. トークン期限切れ後の更新処理を本番環境で検証する

**現状:** 1まで到達。2〜7は本人による認証・接続の実地検証待ちです。
