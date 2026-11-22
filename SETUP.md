# HABIT QUEST 初回ログイン・Oura接続手順

最終更新：2026-11-22。GitHub Pages版の初回利用向け。アプリの実ログイン/Oura認可はユーザー本人のみ操作できます。

## 1. Supabase AuthのURLを設定

[Supabase Authentication > URL Configuration](https://supabase.com/dashboard/project/kpiqktibvzymgzwxiajv/auth/url-configuration) で：

- **Site URL**: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/`
- **Redirect URLs**: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/` を追加

## 1a. メール＋パスワードでログイン（2026-11-22変更）

[HABIT QUEST](https://syachikulifesyachipoke-dotcom.github.io/habit-quest/) を開き、右上の「☁ ログイン」を選びます。メールアドレス・パスワードを入力して「ログイン」を押します。**メールリンクを繰り返し送信する方式は廃止しました。**

既存のメールアドレスにパスワードがない場合の推奨手順：

1. [Supabase > Authentication > URL Configuration](https://supabase.com/dashboard/project/kpiqktibvzymgzwxiajv/auth/url-configuration) を開いて、Site URL・Redirect URLsに `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/` が設定されていることを確認
2. HABIT QUEST の右上「☁ ログイン」で、**すでに登録済みのメールアドレス**を入力し「初回パスワード設定・再設定」を押す
3. 新しく届いたメールのリンクを開く。認証後、パスワード入力画面が自動で開く
4. **12文字以上の新しいパスワード**を設定し、そのまま利用する

すでにログイン中の端末がある場合、メールは不要で右上「☁」→「パスワード設定・変更」から直接設定できます。

**既存メールアドレス用の二つ目のアカウントは作らないでください。** メール送信枠を超えた場合は少し時間を空けてください。パスワードはChatGPTやGitHubに送らず、アプリのフォームへ直接入力してください。


## 2. Oura Developer Portalでアプリ作成

[Oura Applications](https://developer.ouraring.com/applications) の Create Newで以下を登録。既存の独自ドメインが未設定の間は、現在動くGitHub PagesのURLで登録します。

- Display Name: `HABIT QUEST`
- Description: `Personal habit tracker with Oura sleep, activity and workout insights`
- Website: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/`
- Privacy Policy: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/privacy.html`
- Terms of Service: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/terms.html`
- **Redirect URI**: `https://kpiqktibvzymgzwxiajv.supabase.co/functions/v1/oura-service/callback`
- Contact Email: 本人が実際に受信できるアドレス

Client IDはOAuth認証時に公開される識別子で、既に現在配備中のEdge Functionに設定済みです。Client Secretは秘密情報です。過去の画面共有で表示されたSecretはOura Developer PortalのReset Secretで再発行し、新しいものだけをSupabase Secretsに入力してください。また、暗号化キーも画像に写っていたため、Oura接続前なら新しいランダムな値へ入れ替えるのが安全です。GitHub・公開HTML・チャットには載せないでください。

## 3. Supabase Edge Function SecretsにOura認証情報を登録

[Secrets管理画面](https://supabase.com/dashboard/project/kpiqktibvzymgzwxiajv/functions/secrets) でKeyとValueを登録します。

| Key | Value |
| --- | --- |
| `OURA_CLIENT_ID` | 任意：公開Client IDは現在配備中のEdge Functionへ反映済み。将来変更する場合に設定 |
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

- HABIT QUESTの右上「☁ ログイン」からメール＋パスワードでログイン。
- 右上の「💍 Oura」でOura欄を開き、「Ouraアカウント連携」を押して権限 `daily` と `workout` を承認。
- アプリに戻ったら「直近7日同期」で最新データを検証。
- 「過去6か月取込」で過去の記録を取得。候補は40件ずつ追加表示可能。早起きは5:40以前を候補にし、昼寝を主睡眠に含めません。Oura側に記録がある期間のみ取得可能。
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
