import { setup } from "./data";
/** TODO:
 *
 */

interface LineItem {
	// treecode
	ParentKey: string;
	ItemCode: string;
	Quanity?: number; // RouteStages don't have this
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
interface Result {
	items: Item[];
	stages: [RouteStage, Resource][];
}
interface Item extends LineItem {
	quantity: number;
}
interface Resource extends LineItem {
	quantity: number;
}
interface RouteStage extends LineItem {
	quantity: undefined;
}

function run(treeCode: number): Result {
	const isAssembly = false; // TODO: Guess from the desc and the itemcode
	throw new Error("Not implemented");
}

const data = setup();
/// TODO: for each treecode, run the function
// for (const treecode of data) {
// const result = run(data.treeCode);
// console.log(result);
// }
//
