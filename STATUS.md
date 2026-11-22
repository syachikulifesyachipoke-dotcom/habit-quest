# HABIT QUEST — 再監査・障害と未達事項

最終再監査：2026-11-23。公開URL: https://syachikulifesyachipoke-dotcom.github.io/habit-quest/

## 判定の前提
「実装済み」だけでは「本人の実機で利用できた」ことを意味しません。本人認証・Oura実測データの取得・端末間同期は独立の受入試験が必要です。

## 今回修正した問題
1. パスワード未設定ユーザーの復旧画面：Supabaseの `PASSWORD_RECOVERY` イベントと、リダイレクトURLの `type=recovery` 両方で新パスワード設定フォームを開く。認証リンク期限切れの案内も追加。
2. ログイン画面内にSupabase Auth URL設定へのリンクを追加。既存の登録メールアドレスを引き継ぎ、新規の別アカウントを作ることを標準手順としない。
3. パスワード再設定メールの送信結果：API成功と実際の受信を区別して案内する。
4. Oura Edge Functionの暗号化キー（32バイトBase64）の形式確認を実装。接続不可の際に不足項目名・形式上の問題を示す（秘密値は返さない）。
5. Ouraの`daily`権限がない場合に同期ボタン・自動同期を抑制し、再接続を案内する。
6. Ouraデータの最終取得時刻をDBの`synced_at`から計算し、日本時間で表示する。

## 原因と受入状況
| ID | 重要度 | 問題／受入条件 | 現在の確認結果 |
| --- | --- | --- | --- |
| AUTH-01 | 最優先 | 既存の1ユーザーはメール認証済みだがパスワード未設定 | 2026-11-23時点で`encrypted_password`登録者0。再設定メールの本人操作が必要 |
| AUTH-02 | 最優先 | Supabase AuthのSite URL/Redirect URLsが公開アプリURLか | 管理APIが接続ツールに存在せず、実設定は未確認。以前の`localhost:3000`リダイレクトは設定ミスの重要な兆候 |
| AUTH-03 | 高 | 登録済みメールで再設定メール→アプリ→パスワード登録 | 画面処理は実装。本人のメールでの完走は未検証 |
| CLOUD-01 | 高 | PC⇄スマホの習慣データ同期 | DB保存/RLS/競合のSQLまたは模擬テスト済み。実端末間テストは未検証 |
| CLOUD-02 | 中 | オフラインと同期競合 | 端末内保存・競合プロンプト実装。回線断・複数端末の実操作は未検証 |
| OURA-01 | 高 | Oura接続・実測の7日／184日取込 | Server v11稼働、コード/模擬テスト済み。OAuth実承認・実データ取込は未検証 |
| OURA-02 | 高 | 暗号化キーとClient Secretの保護 | 以前のスクリーンショットで両方が露出。Oura実接続前に再発行/再設定を推奨。値はGitHubに載せていない |
| OURA-03 | 中 | Ouraの切断操作 | 現在はアプリ内の解除ボタン未実装。Ouraアカウントの接続済みアプリ画面から権限撤回が可能。将来の改善対象 |
| WEB-01 | 高 | `habit.syachiku-life.com` でHTTPS公開 | 未設定。GitHub Pagesの仮公開URLを利用中。既存のshachipoke設定は変更なし |
| WEB-02 | 中 | ブラウザでの本番画面・スマホ動作 | プログラムの構文/模擬試験実施。実機ブラウザの通し操作は未検証 |
| SECURITY-01 | 高 | Supabaseで新規登録を制限し本人専用にする | 現在のAuth管理設定は未確認。パスワード設定とログイン成功後に公開signupの無効化を推奨 |
| SECURITY-02 | 中 | 漏えいパスワード保護の設定 | Supabase security advisorに`auth_leaked_password_protection`警告が1件 |
| BACKUP-01 | 中 | JSONバックアップ・復元、CSV出力 | 画面・ハンドラが存在する。異なる端末への復元実地試験は未検証 |
| COST-01 | 必須 | 想定外課金防止 | Supabase Free、プロジェクト`ACTIVE_HEALTHY`確認。有料変更なし |

## 今回の確認・テスト
- Supabaseの1ユーザーは認証済み、パスワード設定者0、習慣記録0、Oura連携0、Oura日次0、ワークアウト0。
- App JSのパース成功、HTML内の重複IDなし。Edge Function v11は`ACTIVE`で、GitHubの関数ソースと一致。
- 復旧リンクの暗黙フロー`#...type=recovery`とクエリ`?type=recovery`、普通の訪問、期限切れエラーの判定テスト成功。
- 復旧フォームの表示・フォーカステスト成功。
- Oura暗号化キーの形式不正・認証情報不足・正常判定のモックテスト成功。
- 以前のSQL/模擬テストでクラウド保存revision、Ouraの6か月分を7回に分けた処理、更新トークンの単回使用と競合対策を検証。
- 公式Supabase Auth/Oura API仕様を照合。ただし本番GitHub Pagesへの外部アクセスとログイン・Oura承認のブラウザ操作は現在の接続ツールでは検証できない。

## 本人が次に実行する最小の手順
1. Supabaseの [Auth URL Configuration](https://supabase.com/dashboard/project/kpiqktibvzymgzwxiajv/auth/url-configuration) でSite URLを`https://syachikulifesyachipoke-dotcom.github.io/habit-quest/`に変更し、同URLをRedirect URLsに追加。保存する。
2. [HABIT QUEST](https://syachikulifesyachipoke-dotcom.github.io/habit-quest/) の右上`☁ ログイン`から既存メールを入力し、「初回パスワード設定・再設定」を1回押す。届いた最新メールのリンクで12文字以上の新パスワードを設定。
3. パスワードでログインしたうえで、クラウドの初回記録選択、PC/スマホの双方向同期を実地確認。
4. 露出したOura Client Secret/暗号化キーを認証前に交換し、Ouraで連携を許可。実際に7日分と過去184日分を取込み検証。
5. 問題なく利用できることを確認してから新規登録を無効化。独自ドメインは別工程として切替。

**注意：** パスワード、Oura Client Secret、暗号化キーをチャット・GitHub・スクリーンショットに載せないこと。公開アプリのソースと公開可能なSupabaseキーは秘密情報ではない。
