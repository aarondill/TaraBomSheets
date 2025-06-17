import { stringify } from "csv";
import { parse } from "csv/sync";
import { PathLike } from "fs";
import fs from "fs/promises";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import path from "node:path";
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
		Quantity: string;
	}[];
	routeStagesNumbers: {
		"Internal Number": string;
		Code: string;
	}[];
}

async function readCSV(
	path: PathLike
): Promise<Record<string, string | undefined>[]> {
	const content = await fs.readFile(path, "utf8");
	return parse(content, {
		columns: true,
		trim: true, // NO MORE SPACES!
		skip_empty_lines: true,
		bom: true,
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
	const [allItems, routeStagesAndResources, ittItems, routeStagesNumbers] =
		await Promise.all([
			readCSV("all-items.csv") as Promise<Data["allItems"]>,
			readCSV("route-stages-and-resources.csv") as Promise<
				Data["routeStagesAndResources"]
			>,
			readCSV("itt-items.csv") as Promise<Data["ittItems"]>,
			readCSV("route-stages-numbers.csv") as Promise<
				Data["routeStagesNumbers"]
			>,
		]);
	return { allItems, routeStagesAndResources, ittItems, routeStagesNumbers };
}

export async function outputResults(result: Result[]): Promise<void> {
	const bom = path.join("output", "bom.csv");
	const routeStages = path.join("output", "route-stages.csv");
	await fs.mkdir(path.dirname(bom), { recursive: true });

	const TYPE_NUMS = {
		pit_Item: 4,
		pit_Resource: 290,
		Route: undefined,
	};
	await Promise.all([
		writeCsv(
			bom,
			async write => {
				// write the BOM and resources
				for (const lineItem of result) {
					let lineNum = 0;
					const Warnings = lineItem.Warnings.join("; ");
					const [firstRoute, firstResource, ...restStages] = lineItem.stages;
					if (firstResource)
						await write({
							...firstResource,
							ItemType: TYPE_NUMS[firstResource.ItemType],
							SeqNum: lineNum + 1,
							LineNum: lineNum++,
							Warnings,
						});

					for (const item of lineItem.items) {
						await write({
							...item,
							ItemType: TYPE_NUMS[item.ItemType],
							SeqNum: lineNum + 1,
							LineNum: lineNum++,
							Warnings,
						});
					}

					for (const resource of restStages) {
						if (resource.ItemType !== "pit_Resource") continue; // skip routes
						await write({
							...resource,
							ItemType: TYPE_NUMS[resource.ItemType],
							SeqNum: lineNum + 1,
							LineNum: lineNum++,
							Warnings,
						});
					}
				}
			},
			[
				"Quantity",
				"ParentKey",
				"ItemCode",
				"Warehouse",
				"ItemType",
				"StageId",
				"SeqNum",
				"LineNum",
				"Warnings",
			]
		),
		writeCsv(
			routeStages,
			async write => {
				// write the route stages
				for (const lineItem of result) {
					let lineNum = 0;
					const Warnings = lineItem.Warnings.join("; ");
					for (const stage of lineItem.stages) {
						if (stage.ItemType === "pit_Resource") continue; // skip resources
						await write({
							...stage,
							ItemType: TYPE_NUMS[stage.ItemType],
							SeqNum: lineNum + 1,
							LineNum: lineNum++,
							Warnings,
						});
					}
				}
			},
			[
				"ParentKey",
				"ItemCode",
				"StgEntry",
				"Warehouse",
				"StageId",
				"SeqNum",
				"LineNum",
				"Warnings",
			]
		),
	]);
}

export type ErrorItem = SourceItem & { error: string };
export async function outputErrors(errors: ErrorItem[]): Promise<void> {
	const file = path.join("output", "errors.csv");
	await fs.mkdir(path.dirname(file), { recursive: true });
	return writeCsv(file, async write => {
		for (const error of errors) {
			await write(error);
		}
	});
}
