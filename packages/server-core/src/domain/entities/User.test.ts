import { beforeAll, describe, expect, it } from "vitest";
import { UserFactory, initialize } from "../../testing";
import { User, type UserProps } from "./User";

describe("User Entity", () => {
	beforeAll(() => {
		// ドメインエンティティのテストではPrismaクライアントは使用しないため、空のオブジェクトを渡す
		initialize({ prisma: {} as any });
	});

	describe("constructor", () => {
		it("有効なプロパティでエンティティが生成される", async () => {
			// Given
			const props = await UserFactory.build();

			// When
			const user = new User(props);

			// Then
			expect(user.id).toBeDefined();
			expect(user.email).toBeDefined();
			expect(user.name).toBeDefined();
			expect(user.status).toBeDefined();
			expect(user.role).toBeDefined();
			expect(user.createdAt).toBeInstanceOf(Date);
			expect(user.lastLogin).toBeInstanceOf(Date);
		});

		it("nameがnullでもエンティティが生成される", async () => {
			// Given
			const props = await UserFactory.build({ name: null });

			// When
			const user = new User(props);

			// Then
			expect(user.name).toBeNull();
		});

		it("lastLoginがnullでもエンティティが生成される", async () => {
			// Given
			const props = await UserFactory.build({ lastLogin: null });

			// When
			const user = new User(props);

			// Then
			expect(user.lastLogin).toBeNull();
		});

		it("全てのstatus値でエンティティが生成される", async () => {
			// Given & When & Then
			const statuses = ["active", "inactive", "pending"] as const;
			for (const status of statuses) {
				const props = await UserFactory.build({ status });
				const user = new User(props);
				expect(user.status).toBe(status);
			}
		});

		it("全てのrole値でエンティティが生成される", async () => {
			// Given & When & Then
			const roles = ["admin", "user", "moderator"] as const;
			for (const role of roles) {
				const props = await UserFactory.build({ role });
				const user = new User(props);
				expect(user.role).toBe(role);
			}
		});
	});

	describe("withLastLogin", () => {
		it("最終ログイン日時を更新した新しいインスタンスを返す", async () => {
			// Given
			const props = await UserFactory.build({ lastLogin: null });
			const originalUser = new User(props);
			const newLoginTime = new Date("2025-01-03T12:00:00Z");

			// When
			const updatedUser = originalUser.withLastLogin(newLoginTime);

			// Then
			expect(updatedUser.lastLogin).toEqual(newLoginTime);
			expect(updatedUser).not.toBe(originalUser);
		});

		it("元のインスタンスは変更されない（イミュータビリティ）", async () => {
			// Given
			const originalLastLogin = new Date("2025-01-02T00:00:00Z");
			const props = await UserFactory.build({ lastLogin: originalLastLogin });
			const originalUser = new User(props);
			const newLoginTime = new Date("2025-01-03T12:00:00Z");

			// When
			originalUser.withLastLogin(newLoginTime);

			// Then
			expect(originalUser.lastLogin).toEqual(originalLastLogin);
		});

		it("他のプロパティは維持される", async () => {
			// Given
			const props = await UserFactory.build();
			const originalUser = new User(props);
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
		it("ステータスを更新した新しいインスタンスを返す", async () => {
			// Given
			const props = await UserFactory.build({ status: "pending" });
			const originalUser = new User(props);

			// When
			const updatedUser = originalUser.withStatus("active");

			// Then
			expect(updatedUser.status).toBe("active");
			expect(updatedUser).not.toBe(originalUser);
		});

		it("元のインスタンスは変更されない（イミュータビリティ）", async () => {
			// Given
			const props = await UserFactory.build({ status: "pending" });
			const originalUser = new User(props);

			// When
			originalUser.withStatus("active");

			// Then
			expect(originalUser.status).toBe("pending");
		});
	});

	describe("withRole", () => {
		it("ロールを更新した新しいインスタンスを返す", async () => {
			// Given
			const props = await UserFactory.build({ role: "user" });
			const originalUser = new User(props);

			// When
			const updatedUser = originalUser.withRole("admin");

			// Then
			expect(updatedUser.role).toBe("admin");
			expect(updatedUser).not.toBe(originalUser);
		});

		it("元のインスタンスは変更されない（イミュータビリティ）", async () => {
			// Given
			const props = await UserFactory.build({ role: "user" });
			const originalUser = new User(props);

			// When
			originalUser.withRole("admin");

			// Then
			expect(originalUser.role).toBe("user");
		});
	});

	describe("isActive", () => {
		it("statusがactiveの場合、trueを返す", async () => {
			// Given
			const props = await UserFactory.build({ status: "active" });
			const user = new User(props);

			// When & Then
			expect(user.isActive()).toBe(true);
		});

		it("statusがinactiveの場合、falseを返す", async () => {
			// Given
			const props = await UserFactory.build({ status: "inactive" });
			const user = new User(props);

			// When & Then
			expect(user.isActive()).toBe(false);
		});

		it("statusがpendingの場合、falseを返す", async () => {
			// Given
			const props = await UserFactory.build({ status: "pending" });
			const user = new User(props);

			// When & Then
			expect(user.isActive()).toBe(false);
		});
	});

	describe("isAdmin", () => {
		it("roleがadminの場合、trueを返す", async () => {
			// Given
			const props = await UserFactory.build({ role: "admin" });
			const user = new User(props);

			// When & Then
			expect(user.isAdmin()).toBe(true);
		});

		it("roleがuserの場合、falseを返す", async () => {
			// Given
			const props = await UserFactory.build({ role: "user" });
			const user = new User(props);

			// When & Then
			expect(user.isAdmin()).toBe(false);
		});

		it("roleがmoderatorの場合、falseを返す", async () => {
			// Given
			const props = await UserFactory.build({ role: "moderator" });
			const user = new User(props);

			// When & Then
			expect(user.isAdmin()).toBe(false);
		});
	});
});
