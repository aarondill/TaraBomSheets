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
	isAssembly: boolean
): (RouteStage | Resource)[] {
	const key = itemInfo["ITEM GROUP"] + " - " + (isAssembly ? "ASSY" : "MFG");
	const resources = data.routeStagesAndResources.filter(
		item => item["Item Groups - Type"] === key
	);
	if (resources.length === 0) throw new Error("No resources found: " + key);
	if (resources.length > 1) throw new Error("Too many resources found: " + key);
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

function run(source: SourceItem): Result {
	const items = getItems(source);
	const isAssembly = probablyIsAssembly(source, items);
	const resourcesAndStages = getResourcesAndStages(source, isAssembly);
	return {
		items,
		stages: resourcesAndStages,
	};
}

const data = await getData();
const results = data.allItems.map(run);
await outputResults(results);
