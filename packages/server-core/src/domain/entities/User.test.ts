import { describe, expect, it } from "vitest";
import { createUserProps } from "../../testing/factories/UserFactory";
import { User } from "./User";

describe("User Entity", () => {
	describe("constructor", () => {
		it("有効なプロパティでエンティティが生成される", () => {
			// Given
			const props = createUserProps();

			// When
			const user = new User(props);

			// Then
			expect(user.id).toBe("user-123");
			expect(user.email).toBe("test@example.com");
			expect(user.name).toBe("Test User");
			expect(user.status).toBe("active");
			expect(user.role).toBe("user");
			expect(user.createdAt).toEqual(new Date("2025-01-01T00:00:00Z"));
			expect(user.lastLogin).toEqual(new Date("2025-01-02T00:00:00Z"));
		});

		it("nameがnullでもエンティティが生成される", () => {
			// Given
			const props = createUserProps({ name: null });

			// When
			const user = new User(props);

			// Then
			expect(user.name).toBeNull();
		});

		it("lastLoginがnullでもエンティティが生成される", () => {
			// Given
			const props = createUserProps({ lastLogin: null });

			// When
			const user = new User(props);

			// Then
			expect(user.lastLogin).toBeNull();
		});

		it("全てのstatus値でエンティティが生成される", () => {
			// Given & When & Then
			const statuses = ["active", "inactive", "pending"] as const;
			for (const status of statuses) {
				const user = new User(createUserProps({ status }));
				expect(user.status).toBe(status);
			}
		});

		it("全てのrole値でエンティティが生成される", () => {
			// Given & When & Then
			const roles = ["admin", "user", "moderator"] as const;
			for (const role of roles) {
				const user = new User(createUserProps({ role }));
				expect(user.role).toBe(role);
			}
		});
	});

	describe("withLastLogin", () => {
		it("最終ログイン日時を更新した新しいインスタンスを返す", () => {
			// Given
			const originalUser = new User(createUserProps({ lastLogin: null }));
			const newLoginTime = new Date("2025-01-03T12:00:00Z");

			// When
			const updatedUser = originalUser.withLastLogin(newLoginTime);

			// Then
			expect(updatedUser.lastLogin).toEqual(newLoginTime);
			expect(updatedUser).not.toBe(originalUser);
		});

		it("元のインスタンスは変更されない（イミュータビリティ）", () => {
			// Given
			const originalLastLogin = new Date("2025-01-02T00:00:00Z");
			const originalUser = new User(createUserProps({ lastLogin: originalLastLogin }));
			const newLoginTime = new Date("2025-01-03T12:00:00Z");

			// When
			originalUser.withLastLogin(newLoginTime);

			// Then
			expect(originalUser.lastLogin).toEqual(originalLastLogin);
		});

		it("他のプロパティは維持される", () => {
			// Given
			const originalUser = new User(createUserProps());
			const newLoginTime = new Date("2025-01-03T12:00:00Z");

			// When
			const updatedUser = originalUser.withLastLogin(newLoginTime);

			// Then
			expect(updatedUser.id).toBe(originalUser.id);
			expect(updatedUser.email).toBe(originalUser.email);
			expect(updatedUser.name).toBe(originalUser.name);
			expect(updatedUser.status).toBe(originalUser.status);
			expect(updatedUser.role).toBe(originalUser.role);
			expect(updatedUser.createdAt).toEqual(originalUser.createdAt);
		});
	});

	describe("withStatus", () => {
		it("ステータスを更新した新しいインスタンスを返す", () => {
			// Given
			const originalUser = new User(createUserProps({ status: "pending" }));

			// When
			const updatedUser = originalUser.withStatus("active");

			// Then
			expect(updatedUser.status).toBe("active");
			expect(updatedUser).not.toBe(originalUser);
		});

		it("元のインスタンスは変更されない（イミュータビリティ）", () => {
			// Given
			const originalUser = new User(createUserProps({ status: "pending" }));

			// When
			originalUser.withStatus("active");

			// Then
			expect(originalUser.status).toBe("pending");
		});
	});

	describe("withRole", () => {
		it("ロールを更新した新しいインスタンスを返す", () => {
			// Given
			const originalUser = new User(createUserProps({ role: "user" }));

			// When
			const updatedUser = originalUser.withRole("admin");

			// Then
			expect(updatedUser.role).toBe("admin");
			expect(updatedUser).not.toBe(originalUser);
		});

		it("元のインスタンスは変更されない（イミュータビリティ）", () => {
			// Given
			const originalUser = new User(createUserProps({ role: "user" }));

			// When
			originalUser.withRole("admin");

			// Then
			expect(originalUser.role).toBe("user");
		});
	});

	describe("isActive", () => {
		it("statusがactiveの場合、trueを返す", () => {
			// Given
			const user = new User(createUserProps({ status: "active" }));

			// When & Then
			expect(user.isActive()).toBe(true);
		});

		it("statusがinactiveの場合、falseを返す", () => {
			// Given
			const user = new User(createUserProps({ status: "inactive" }));

			// When & Then
			expect(user.isActive()).toBe(false);
		});

		it("statusがpendingの場合、falseを返す", () => {
			// Given
			const user = new User(createUserProps({ status: "pending" }));

			// When & Then
			expect(user.isActive()).toBe(false);
		});
	});

	describe("isAdmin", () => {
		it("roleがadminの場合、trueを返す", () => {
			// Given
			const user = new User(createUserProps({ role: "admin" }));

			// When & Then
			expect(user.isAdmin()).toBe(true);
		});

		it("roleがuserの場合、falseを返す", () => {
			// Given
			const user = new User(createUserProps({ role: "user" }));

			// When & Then
			expect(user.isAdmin()).toBe(false);
		});

		it("roleがmoderatorの場合、falseを返す", () => {
			// Given
			const user = new User(createUserProps({ role: "moderator" }));

			// When & Then
			expect(user.isAdmin()).toBe(false);
		});
	});
});
