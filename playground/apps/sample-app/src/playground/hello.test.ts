import { describe, expect, it, vi } from "vitest";
import { helloWorld } from "@/playground/hello";

describe("helloWorld", () => {
	it("should log 'Hello, Playground!'", () => {
		const consoleSpy = vi.spyOn(console, "log");
		helloWorld();
		expect(consoleSpy).toHaveBeenCalledWith("Hello, Playground!");
		consoleSpy.mockRestore();
	});
});
