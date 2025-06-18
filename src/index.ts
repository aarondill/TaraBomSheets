import { getData, outputResults, SourceItem } from "./data";
/** TODO:
 *
 */

interface LineItem {
	// treecode
	ParentKey: string;
	ItemCode: string;
	Quantity: string; // RouteStages don't have this
	Warehouse: "040";
	ItemType: "Route" | "pit_Resource" | "pit_Item";
	StageId?: number | "";
}
/*
 * These should be output as:
 * stages[0][0]
 * stages[0][1]
 * ...items
 * stages[1][0]
 * stages[1][1]
 * ...
 * stages[n][0]
 * stages[n][1]
 */
export interface Result {
	ParentKey: string; // PN#, TreeCode, or ParentKey
	Warnings: string[];
	items: Item[];
	stages: (Resource | RouteStage)[];
}
interface Item extends LineItem {
	Quantity: string;
	ItemType: "pit_Item";
}
interface Resource extends LineItem {
	Quantity: string;
	ItemType: "pit_Resource";
}
interface RouteStage extends LineItem {
	Quantity: "";
	StgEntry: string;
	ItemType: "Route";
}

// Guess from the desc and the itemcode
function probablyIsAssembly(itemInfo: SourceItem, subitems: Item[]): boolean {
	// if desc contains "ASSY"
	if (itemInfo.DESCRIPTION.match(/\bASSY\b/) != null) return true;
	// if desc contains "FRACMASTER"
	if (itemInfo.DESCRIPTION.match(/\bFRACMASTER\b/) != null) return true;
	// if itemcode starts with "AP"
	if (subitems.some(item => item.ItemCode.startsWith("AP"))) return true;
	return false;
}

function getItems(itemInfo: SourceItem): Item[] {
	const items = data.ittItems.filter(
		item => item.ParentKey === itemInfo["PN#"]
	);
	return items.map(constructItem);
}
function constructItem(itemInfo: (typeof data.ittItems)[number]): Item {
	return {
		Quantity: itemInfo.Quantity,
		ParentKey: itemInfo.ParentKey,
		ItemCode: itemInfo.ItemCode,
		Warehouse: "040",
		ItemType: "pit_Item",
	};
}

function getResourcesAndStages(
	itemInfo: SourceItem,
	isAssembly: boolean,
	warnings: string[] /** This gets mutated! */
): (RouteStage | Resource)[] {
	if (
		itemInfo["MAKE / BUY"] === "Buy" &&
		itemInfo["BOM Type"] === "Not a BOM"
	) {
		return []; // these don't have resources
	}
	if (IGNORED_GROUPS.includes(itemInfo["ITEM GROUP"])) return [];

	const key = itemInfo["ITEM GROUP"] + " - " + (isAssembly ? "ASSY" : "MFG");
	const stagesAndResources = data.routeStagesAndResources.filter(
		item => item["Item Groups - Type"] === key
	);
	if (stagesAndResources.length <= 1) {
		const warning =
			stagesAndResources.length === 0
				? `No resources found for ${key}`
				: `Only one resource found for ${key}`;
		warnings.push(warning);
		return [];
	}
	return stagesAndResources.map(resource => {
		const Quantity = resource.Quantity,
			ParentKey = itemInfo["PN#"],
			ItemCode = resource.ItemCode,
			Warehouse = "040";
		if (Quantity === "") {
			const StgEntry =
				data.routeStagesNumbers.find(entry => entry.Code === ItemCode)?.[
					"Internal Number"
				] ?? "";
			if (StgEntry === "") warnings.push(`No StgEntry found for ${ItemCode}`);
			return {
				Quantity,
				ParentKey,
				ItemCode,
				StgEntry,
				Warehouse,
				ItemType: "Route",
			} as const;
		}
		return {
			Quantity,
			ParentKey,
			ItemCode,
			Warehouse,
			ItemType: "pit_Resource",
		};
	});
}

const IGNORED_GROUPS: string[] = [
	"ARCHIVE",
	"OBSOLETE PARTS",
	"OUTSIDE PROCESSES",
	"QC-TOOLING / GAUGES",
	"R & D",
	"CSS-OBSO PARTS",
];
function run(source: SourceItem): Result | null {
	const items = getItems(source);
	const isAssembly = probablyIsAssembly(source, items);
	const warnings: string[] = [];
	const stages = getResourcesAndStages(source, isAssembly, warnings);
	if (items.length === 0 && stages.length === 0) return null;
	return {
		ParentKey: source["PN#"],
		Warnings: warnings,
		items,
		stages,
	};
}

function formatStageIds(input: Result): Result {
	const [firstStage, firstResource, ...restStages] = input.stages;
	if (!firstStage) {
		const items = input.items.map(item => ({ ...item, StageId: "" }) as const);
		return { ...input, items };
	}

	const items = input.items;
	let StageId = 1;

	const result: Result = {
		...input,
		items: [],
		stages: [],
		Warnings: input.Warnings,
	};
	if (firstStage) {
		result.stages.push({ ...firstStage, StageId });
	}
	if (firstResource) {
		result.stages.push({ ...firstResource, StageId });
	}
	for (const item of items) {
		result.items.push({ ...item, StageId });
	}
	for (const resource of restStages) {
		if (resource.ItemType == "Route") StageId++; // the rest is a part of the next stage
		result.stages.push({ ...resource, StageId });
	}
	return result;
}

const data = await getData();
const resultByPN = new Map<string, Result>();

for (const source of data.allItems) {
	const result = run(source);
	if (result === null) continue;
	if (resultByPN.has(result.ParentKey)) {
		console.error("Duplicate ParentKey " + result.ParentKey + "! Ignoring.");
		continue;
	}
	resultByPN.set(source["PN#"], result);
}

const ittMissing = data.ittItems
	.filter(
		item => !data.allItems.some(source => source["PN#"] === item.ParentKey)
	)
	.map(constructItem);
for (const item of ittMissing) {
	if (!resultByPN.has(item.ParentKey))
		resultByPN.set(item.ParentKey, {
			ParentKey: item.ParentKey,
			items: [],
			stages: [],
			Warnings: [`ParentKey not in production items`],
		});
	resultByPN.get(item.ParentKey)!.items.push(item);
}

const results = Array.from(resultByPN.values().map(formatStageIds));
for (const result of results) {
	if (result.Warnings.length > 0) {
		console.warn("Warnings for " + result.ParentKey + ":");
		for (const warning of result.Warnings) {
			console.warn("       " + warning);
		}
	}
}
await outputResults(results);
