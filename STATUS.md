# HABIT QUEST — 現状確認（2026-11-23）

## 最新の実測結果

| 項目 | 状態 | 根拠 |
| --- | --- | --- |
| Supabase認証URL | 正しく設定済み | ユーザー提供のURL Configuration画面。Site URLとRedirect URLsが一致 |
| HABIT QUESTの表示 | 正常に表示される | ユーザー提供のアプリ画面。右上は「☁ 保存済」 |
| アカウント | 1件・メール認証済み | auth.usersの集計 |
| パスワード | **設定済み（1件）** | auth.usersの暗号化パスワード登録状況 |
| セッション | **有効なものが1件** | auth.sessions |
| ログイン履歴 | **2026-11-23 08:31 JST** | auth.users.last_sign_in_at |
| クラウド初回保存 | **成功（revision 1）** | habit_states 1行、2026-11-23 08:31 JST |
| 保存データ | 初期の5習慣、達成チェック0日 | habit_statesのJSONの集計 |
| 本人の記録参照 | 成功 | authenticatedロールで本人の1件が見える |
| 非ログインの記録参照 | 拒否 | anonのSELECT権限なし |
| Oura認証トークン | 非公開 | anon・authenticatedの両方で直接SELECT不可 |
| Ouraサーバー | v11 ACTIVE | Supabase Edge Function。ステータスAPIのGETは200 |
| 料金 | Freeのまま | Supabase組織プラン |

## やり直し不要

- SupabaseのSite URL・Redirect URLs：設定済み。再設定しない
- 既存メールアドレス・パスワード：設定済み。新規アカウント作成・再設定メール申請は不要
- 現在ログイン中のセッションと初期習慣記録：保持する

## 残る未検証項目

| 項目 | 状況 |
| --- | --- |
| PCとスマホで同じデータの双方向同期 | コードとDBの模擬試験のみ。実機試験は未実施 |
| Ouraの初回OAuth承認 | 未実施。oura_connections 0件 |
| Ouraの睡眠・運動データ取得 | 未実施。日次・ワークアウトともに0件 |
| 7日・過去184日同期 | 実Ouraデータでは未検証 |
| Ouraアクセストークン自動更新 | モックテストのみ |
| Ouraのアプリ内接続解除 | 未実装 |
| 独自ドメイン habit.syachiku-life.com | 未設定。現在はGitHub Pagesを利用 |
| 新規ユーザー登録の停止 | 設定状態未確認 |
| 漏えいパスワード保護 | Supabase Security Advisorの警告1件 |

## 次の作業

1. 習慣ゲームは既存のログイン状態でそのまま利用可能。追加のパスワード操作は不要
2. Oura利用時は公開済みの秘密値を安全に再発行した上で「💍 Oura」→「Ouraアカウント連携」へ進む
3. Oura認証後に「直近7日同期」→「過去6か月取込」で本番データを検証
4. スマートフォン等の別端末から同じアカウントでログインし、双方向の同期をテスト

## 履歴の訂正

以前のSTATUS.mdの「パスワード0件」「習慣保存0件」「URL未確認」は古い確認時点の情報。最新のDB照会とユーザー提供画像に基づき訂正した。
