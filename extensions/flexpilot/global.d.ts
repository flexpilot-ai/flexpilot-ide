// platform.d.ts
declare namespace NodeJS {
	interface Process {
		readonly platform: "aix" | "darwin" | "freebsd" | "linux" | "openbsd" | "sunos" | "win32" | "web"; // Add "web" to the existing list
	}
}
