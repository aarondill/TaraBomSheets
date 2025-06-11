import { stringify } from "csv";
import { parse } from "csv/sync";
import { PathLike } from "fs";
import fs from "fs/promises";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
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
		// Buy or Not a BOM don't get routeStagesAndResources
		"MAKE / BUY": "Make" | "Buy";
		"BOM Type": "Not a BOM" | "Production";
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
/**
 * Writes a CSV file to the given path.
 * @param path The path to write to.
 * @param cb A callback that takes a stream and write the records to it.
 * @param columns The (optional) columns to write to the CSV file. If undefined, columns will be inferred from the data.
 */
function writeCsv(
	path: PathLike,
	cb: (write: (data: unknown) => Promise<void>) => Promise<void>,
	columns?: string[]
): Promise<void> {
	const writableStream = createWriteStream(path);
	const stringifier = stringify({ header: true, columns });
	stringifier.pipe(writableStream);
	const { promise, resolve, reject } = Promise.withResolvers<void>();
	writableStream.on("finish", resolve).on("error", reject);
	void cb(async (data: unknown) => {
		if (!stringifier.write(data)) await once(stringifier, "drain");
	})
		.then(() => stringifier.end())
		.catch(reject);
	return promise;
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

export function outputResults(result: Result[]): Promise<void> {
	return writeCsv("output.csv", async write => {
		for (const lineItem of result) {
			const [firstStage, firstResource, ...restStages] = lineItem.stages;
			let lineNum = 1;
			if (firstStage) await write({ ...firstStage, lineNum: lineNum++ });
			if (firstResource) await write({ ...firstResource, lineNum: lineNum++ });

			for (const item of lineItem.items) {
				await write({ ...item, lineNum: lineNum++ });
			}

			for (const stage of restStages) {
				await write({ ...stage, lineNum: lineNum++ });
			}
		}
	});
}

export type ErrorItem = SourceItem & { error: string };
export function outputErrors(errors: ErrorItem[]): Promise<void> {
	return writeCsv("errors.csv", async write => {
		for (const error of errors) {
			await write(error);
		}
	});
}
