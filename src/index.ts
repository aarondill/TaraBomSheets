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
	// LineNum counts from 1
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
	Warnings: string[];
	items: Item[];
	stages: (RouteStage | Resource)[];
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
	return items.map(item => ({
		Quantity: item.Quanity,
		ParentKey: item.ParentKey,
		ItemCode: item.ItemCode,
		Warehouse: "040",
		ItemType: "pit_Item",
	}));
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
	const resources = data.routeStagesAndResources.filter(
		item => item["Item Groups - Type"] === key
	);
	if (resources.length <= 1) {
		const warning =
			resources.length === 0
				? `No resources found for ${key}`
				: `Only one resource found for ${key}`;
		warnings.push(warning);
		return [];
	}
	return resources.map(resource => {
		const Quantity = resource.Quantity,
			ParentKey = itemInfo["PN#"],
			ItemCode = resource.ItemCode,
			Warehouse = "040";
		return Quantity === ""
			? { Quantity, ParentKey, ItemCode, Warehouse, ItemType: "Route" }
			: { Quantity, ParentKey, ItemCode, Warehouse, ItemType: "pit_Resource" };
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
	const resourcesAndStages = getResourcesAndStages(
		source,
		isAssembly,
		warnings
	);
	return {
		Warnings: warnings,
		items,
		stages: resourcesAndStages,
	};
}

const data = await getData();
const results: Result[] = [];

for (const source of data.allItems) {
	const result = run(source);
	if (result === null) continue;
	results.push(result);
	if (result.Warnings.length > 0) {
		console.warn("Warnings for " + source["PN#"] + ":");
		for (const warning of result.Warnings) {
			console.warn("       " + warning);
		}
	}
}
await outputResults(results);
