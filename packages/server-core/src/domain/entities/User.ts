/**
 * User Entity
 *
 * ドメイン層のユーザーエンティティ。
 * Prismaモデルから独立したドメインオブジェクトとして定義。
 */

export type UserStatus = "active" | "inactive" | "pending";

export type UserRole = "admin" | "user" | "moderator";

export interface UserProps {
	readonly id: string;
	readonly email: string;
	readonly name: string | null;
	readonly status: UserStatus;
	readonly role: UserRole;
	readonly createdAt: Date;
	readonly lastLogin: Date | null;
}

/**
 * ユーザーエンティティ
 *
 * イミュータブルなドメインオブジェクト。
 * 状態変更は新しいインスタンスを生成することで行う。
 */
export class User {
	readonly id: string;
	readonly email: string;
	readonly name: string | null;
	readonly status: UserStatus;
	readonly role: UserRole;
	readonly createdAt: Date;
	readonly lastLogin: Date | null;

	constructor(props: UserProps) {
		this.id = props.id;
		this.email = props.email;
		this.name = props.name;
		this.status = props.status;
		this.role = props.role;
		this.createdAt = props.createdAt;
		this.lastLogin = props.lastLogin;
	}

	/**
	 * 最終ログイン日時を更新した新しいUserインスタンスを返す
	 */
	withLastLogin(loginTime: Date): User {
		return new User({
			id: this.id,
			email: this.email,
			name: this.name,
			status: this.status,
			role: this.role,
			createdAt: this.createdAt,
			lastLogin: loginTime,
		});
	}

	/**
	 * ステータスを更新した新しいUserインスタンスを返す
	 */
	withStatus(status: UserStatus): User {
		return new User({
			id: this.id,
			email: this.email,
			name: this.name,
			status,
			role: this.role,
			createdAt: this.createdAt,
			lastLogin: this.lastLogin,
		});
	}

	/**
	 * ロールを更新した新しいUserインスタンスを返す
	 */
	withRole(role: UserRole): User {
		return new User({
			id: this.id,
			email: this.email,
			name: this.name,
			status: this.status,
			role,
			createdAt: this.createdAt,
			lastLogin: this.lastLogin,
		});
	}

	/**
	 * アクティブなユーザーかどうか
	 */
	isActive(): boolean {
		return this.status === "active";
	}

	/**
	 * 管理者かどうか
	 */
	isAdmin(): boolean {
		return this.role === "admin";
	}
}
