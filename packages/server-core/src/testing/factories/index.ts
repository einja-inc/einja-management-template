/**
 * ファクトリーのエクスポート
 */

// fabbricaの初期化関数をエクスポート
export { initialize } from "../../__generated__/fabbrica";

// ユーザーファクトリー
export {
  UserFactory,
  ActiveUserFactory,
  InactiveUserFactory,
  PendingUserFactory,
  AdminUserFactory,
  ModeratorUserFactory,
  VerifiedUserFactory,
} from "./user.factory";

// 将来的に他のモデルのファクトリーもここに追加
// export { AccountFactory } from "./account.factory";
// export { SessionFactory } from "./session.factory";
