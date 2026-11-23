# HABIT QUEST 4.0

習慣トラッカー × RPG育成 × 分析 × Oura Ring連携。個人利用向けWebアプリです。

## 現在の状態

- アプリ本体はGitHub Pagesで公開済み。独自ドメイン接続は未実施。
- Supabaseプロジェクト `habit-quest` (東京): [管理画面](https://supabase.com/dashboard/project/kpiqktibvzymgzwxiajv)。Freeプラン。
- DB・RLS・Oura OAuthサーバーは稼働中。**Ouraアカウント接続と日次184日・ワークアウト338件の取得を実データで確認済み**。トークン期限切れ後の実更新は未検証。
- 現在のOura Edge Functionソースは `supabase/functions/oura-service/index.ts` に保存しています。変更後はSupabase側への再デプロイが必要です。

## 残りの作業

- 既存アカウントのパスワード登録・ログイン・クラウド初回保存は成功済み（2026-11-23にDBで確認）。
- **Oura自動反映は稼働中**。手動習慣を紫・上段、Oura自動習慣を青緑・下段に配置。筋トレ、サイクリング、ウォーキング、ランニングは別項目。ピラティスとダンスは非表示・再生成禁止。5:00〜6:59の起床を自動チェック。現在8習慣・173自動チェックがクラウドに保存済み。
- 独自ドメインへの切替（後回し可）。PWAアイコンとブラウザfaviconの設定は完了。
- 技術的な検証結果は[STATUS.md](./STATUS.md)を参照。

## 公開手順

1. GitHub Pagesは設定済み。公開URLを確認する。
2. GitHub Pagesの仮URL `https://syachikulifesyachipoke-dotcom.github.io/habit-quest/` にアクセスし、画面が表示されるか確認する。
3. 独自ドメイン `habit.syachiku-life.com` を利用する場合、既存のDNSレコードを壊さないように、`habit` のCNAMEのみGitHub Pagesのホストへ向け、GitHub Pages側にも独自ドメインを登録する。DNS設定前に `CNAME` ファイルは登録していません。
4. SupabaseのSite URLとRedirect URLsは公開URLに設定済み（ユーザー提供画像で確認）。再設定不要。新規登録の無効化は別途確認する。
5. Oura Developer Portalにアプリ名、公開されたWebサイト、プライバシーポリシー、利用規約、OAuth Redirect URIを入力する。
6. Client IDはEdge Functionコードに設定済み。SecretはSupabaseの管理画面で確認し、必要なら再設定する。**秘密値をGitHubにコミットしないこと。**
7. [SETUP.md](./SETUP.md) の手順でメール＋パスワードのログイン・クラウド同期・Oura最新7日と過去6か月取込・ログアウト・復元を実地検証する。

OuraのRedirect URI: `https://kpiqktibvzymgzwxiajv.supabase.co/functions/v1/oura-service/callback`

## 仕組み

- `index.html`: 週間トラッカー、RPG、統計、Oura操作、Supabaseログイン。
- `cloud-config.js`: **公開可能な**Supabase URL・publishable keyのみ。
- `privacy.html`, `terms.html`: Oura登録で使用する説明ページ。
- `supabase/functions/oura-service/index.ts`: Oura OAuth・同期処理。実データ接続後に追加のE2E検証が必要です。
- `images/`: 将来の共通キャラクター・背景・アイテム画像。個人画像やOuraデータは置かないこと。

## セキュリティと料金

個人の習慣記録・Ouraデータ・暗号化トークンはSupabaseに保存し、GitHubの公開リポジトリには置きません。ブラウザに置けるのはSupabaseの公開可能なキーだけです。Supabase Freeプランを維持し、有料プランへ変更しない限り、無料枠超過による自動従量課金は発生しません。ただし無料サービスの利用制限や休止は起こり得ます。JSONバックアップを定期的に取得してください。

**認証・クラウド初回保存・Oura実接続・184日分のデータ取込は実動作確認済み。** Ouraの自動反映はクラウドに173件保存済み。PC↔スマホ同期とトークン自動更新は実地検証待ちです。

## 経験値の起算日（正式仕様）

- **各ユーザーの初回ログイン日（日本時間）を一度だけ保存**します。初めてログインする人はその日がXPの起算日になります。
- 既存利用者は2026-11-23を起算日としてSupabaseに設定しました。過去のOura／手動チェック履歴は削除せず、**起算日より前の実績はXPと週間ボーナスに含めません**。
- XPは起算日以降のチェック1件につき20、週目標達成ボーナス100。初回ログインが週の途中であれば、残り日数に合わせて週目標を調整します。
- `xpStartDate`をクラウドの習慣記録／JSONバックアップに保存。Supabaseの`hq_fix_xp_start_date`トリガーで、設定後に端末やインポートから変更・リセットできないよう保護しています。
- レベルは1〜50。進化形態は11段階、図鑑はLv.1〜50の全レベルを展開表示できます。Lv.50到達後はMAX表示です。

## スマートフォンの週間チェック

- Loop Habit Tracker・Habitifyの週間ビューを参考に、**共通7曜日ヘッダーと1習慣1行のグリッド**に変更しました。
- トラッカーをスマホでは画面上部へ配置。手動チェックを紫で先に表示し、Oura自動記録を青緑の折りたたみ欄へまとめています。
- 画面幅が狭いときのみ週間グリッド部分を左右スクロールできます。日付と習慣が毎行縦方向に伸びる旧レイアウトは廃止しました。
