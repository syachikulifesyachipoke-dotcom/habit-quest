# HABIT QUEST 初回ログイン・Oura接続手順

最終更新：2026-11-23。本人認証・初回クラウド保存・Oura実認証・過去184日のデータ取得まで確認済み。残りは習慣反映と端末間同期の実機検証です。

## 1. Supabase AuthのURL（設定済み・再設定不要）

[Supabase Authentication > URL Configuration](https://supabase.com/dashboard/project/kpiqktibvzymgzwxiajv/auth/url-configuration) で：

- **Site URL**: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/`
- **Redirect URLs**: `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/` を追加

## 1a. メール＋パスワードログイン（既存アカウントで成功済み）

[HABIT QUEST](https://syachikulifesyachipoke-dotcom.github.io/habit-quest/) を開き、右上の「☁ ログイン」を選びます。メールアドレス・パスワードを入力して「ログイン」を押します。**メールリンクを繰り返し送信する方式は廃止しました。**

以下は、今後パスワードを忘れた場合だけ使用する復旧手順です。今は実施不要です：

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

- HABIT QUESTの右上が「☁ 保存済」ならログインは済んでいます。再度ログインする必要はありません。
- 右上の「💍 Oura」でOura欄を開き、「Ouraアカウント連携」を押して権限 `daily` と `workout` を承認。
- アプリに戻ったら「直近7日同期」で最新データを検証。
- 「過去6か月取込」で184日分の実データを取得済み。以後はアプリを開いたとき、Ouraの最新データを取得してチェックを自動更新します。
- **Ouraの自動チェックは常時ON**。起床が日本時間で5:00〜6:59の主睡眠終了時刻なら「5〜6時台に起床」をチェックします。これはOuraの推定であり、実際の起床が異なる日はゲームの週チェックから手動訂正できます。
- ワークアウトは種別ごとに「筋トレ」「サイクリング」「ウォーキング」「ランニング」などを個別習慣として作成し、10分以上のワークアウトを自動達成とします。「家事」は運動習慣の自動対象外です。自動追加された運動項目は初期状態では週ミッションの達成条件に含めず、XPと分析には反映します。週の目標回数を設定したい場合は各習慣の編集画面で保存してください。
- 2026-11-23のクラウド記録は、起床67日、ウォーキング98日、筋トレ3日、サイクリング3日、ランニング2日（計173チェック）。ピラティスとダンスは表示・自動作成を停止しました。
- 既存の「筋トレ・運動」に自動入力していた8日分は、新しい活動別チェックと二重にならないように移行します。手動入力した他の習慣や記録は保持します。
- 自動反映チェックは◆で識別。手動で取り消した日が次のOura同期で勝手に復活しないようにしています。
- 習慣のアイコンは統一したSVG線画に変更。手動習慣が上段・紫、自動習慣が下段・青緑です。ブラウザタブには卵アイコンが出ます。スマホにはPWAとしてホーム画面への追加ができます。
- 初回以降はアプリを開いたとき、また画面を再表示したときに前回試行から6時間以上なら同期を試みます。アプリを閉じている間の常時同期ではありません。
- 連携を止めたい場合はOura欄の「Oura連携を停止」を押します。Supabase内のOura連携トークンが削除され、新規取得は停止します。**過去の測定データは残り、Oura側のアプリ許可はOuraのアカウント画面で別途取り消してください。**

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

**現状:** 1・2確認済み。3はクラウド保存を確認済み、PC↔スマホ同期は未検証。4・5・6はOura実接続、日次184日、ワークアウト338件の取得まで確認済み。新仕様のOura→種別別習慣自動反映はロジック試験済みで、再読み込み後の実端末確認待ち。7は期限切れ後の実トークン更新が未検証です。

## 接続済みの場合の認証情報の交換（安全な順番）

Oura接続が成功した後に`OURA_TOKEN_KEY`を直接上書きすると、保存済みの暗号化トークンを復号できなくなります。漏えいしたキーを交換する場合は、**Oura欄の「Oura連携を停止」→Oura Client Secretと暗号化キーを再発行してSupabase Secretsに設定→Ouraを再接続**の順番にしてください。現在取得済みの測定データや習慣記録は、連携停止では削除しません。シークレットをチャットやGitHubには貼らないでください。

## 利用中に増えたOura項目の扱い

Oura自動習慣は毎日の必須目標としては数えず、XPと分析に反映します。各項目の編集画面で明示的に週目標を設定すると、週間ミッションにも含められます。活動カテゴリの「ピラティス」「ダンス」は今後自動再作成しませんが、元のOura運動履歴はSupabaseに残しています。

## 進化・XP・スマホ表示（2026-11-23追加）

- 習慣アプリへの**初回ログイン日がXP開始日**です。起算日はクラウドに保存され、その後のログインではリセットされません。現在のアカウントは`2026-11-23`からスタート。
- 過去のOura実績・手動チェックは履歴や分析に残りますが、過去分を一括取込しても起算日前のチェックはXPに加算されません。
- 新規ユーザーも同じ仕様です。初回ログインが週の途中なら、最初の週だけ残り日数に応じた目標回数を使用します。
- 進化図鑑はレベル50まで。通常は現在と次の進化を表示し、「レベル1〜50の進化図鑑を開く」で全レベルを確認できます。
- スマホでは週間トラッカーが上に表示されます。7曜日は共通ヘッダーに1回だけ表示され、手動習慣のチェックは1行で操作できます。必要なときだけ「Oura 自動反映」の見出しをタップして運動実績を開いてください。
- スマホが狭い場合、週間表の中を少し横に動かせます。ページ全体を縦方向へ何度も往復する必要はありません。
