import { stringify } from "csv";
import { parse } from "csv/sync";
import { PathLike } from "fs";
import fs from "fs/promises";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { Writable } from "node:stream";
import { Result } from ".";

export type SourceItem = Data["allItems"][number];
/**
 * This represents the aggregated data from the spreadsheets
 */
export interface Data {
	allItems: {
		"ITEM GROUP": string;
		"PN#": string;
		DESCRIPTION: string;
	}[];
	routeStagesAndResources: {
		// "ITEM GROUP" + " ASSY" or "ITEM GROUP" + " MFG"
		"Item Groups - Type": string; // search for all that match this
		ItemCode: string;
		Quantity: string; // if it has a quantity, it's a Resource, otherwise it's a RouteStage
	}[];
	ittItems: {
		ParentKey: string;
		ItemCode: string;
		Quanity: string;
	}[];
}

async function readCSV(
	path: PathLike
): Promise<Record<string, string | undefined>[]> {
	const content = await fs.readFile(path, "utf8");
	return parse(content, {
		columns: true,
		skip_empty_lines: true,
	}) as Record<string, string>[];
}

export async function getData(): Promise<Data> {
	const [allItems, routeStagesAndResources, ittItems] = await Promise.all([
		readCSV("all-items.csv") as Promise<Data["allItems"]>,
		readCSV("route-stages-and-resources.csv") as Promise<
			Data["routeStagesAndResources"]
		>,
		readCSV("itt-items.csv") as Promise<Data["ittItems"]>,
	]);
	return { allItems, routeStagesAndResources, ittItems };
}

async function write(stream: Writable, data: any) {
	if (!stream.write(data)) return once(stream, "drain");
}

export async function outputResults(result: Result[]): Promise<void> {
	const writableStream = createWriteStream("output.csv");
	const stringifier = stringify({ header: true });
	stringifier.pipe(writableStream);
	return new Promise(async (resolve, reject) => {
		writableStream.on("finish", resolve);
		writableStream.on("error", reject);
		for (const lineItem of result) {
			const [firstStage, firstResource, ...restStages] = lineItem.stages;
			let lineNum = 1;
			await write(stringifier, { ...firstStage, lineNum: lineNum++ });
			await write(stringifier, { ...firstResource, lineNum: lineNum++ });
			for (const item of lineItem.items) {
				await write(stringifier, { ...item, lineNum: lineNum++ });
			}
			for (const stage of restStages) {
				await write(stringifier, { ...stage, lineNum: lineNum++ });
			}
		}
		stringifier.end();
	});
}
