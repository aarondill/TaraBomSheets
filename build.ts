#!/usr/bin/env bun
// eslint-disable-next-line @typescript-eslint/naming-convention
import Bun from "bun";
import fs from "node:fs/promises";
import path from "node:path";

const distPath = path.join(import.meta.dir, "dist");
async function main() {
	await fs
		.rm(distPath, { recursive: true, force: true })
		.then(() => fs.mkdir(distPath));

	const res = await Bun.build({
		entrypoints: ["./src/index.ts"],
		target: "browser",
		splitting: false,
		minify: true,
		root: "./src/",
	});

	// Output logs
	const logMap = {
		warning: console.warn,
		warn: console.warn,
		error: console.error,
		info: console.info,
		debug: console.debug,
		verbose: console.log,
	};
	for (const log of res.logs) logMap[log.level](log);
	if (!res.success) {
		process.exitCode = 1;
		console.error("Bundle step failed. Aborting.");
		return;
	}

	const loaderRegex = /^[jt]sx?$/;
	const extensionRegex = /\..*?$/;
	for (const output of res.outputs) {
		const dest = path.resolve(distPath, output.path);
		await fs.mkdir(path.dirname(dest), { recursive: true });
		if (output.kind === "entry-point" && loaderRegex.test(output.loader)) {
			const file = Bun.file(dest.replace(extensionRegex, ".html"));
			const fileWriter = file.writer();
			fileWriter.write("data:text/html,<script>");
			fileWriter.write((await output.text()).trim());
			fileWriter.write("</script>\n");
			await fileWriter.end();
		} else {
			await Bun.write(dest, output);
		}
	}
}
await main();
