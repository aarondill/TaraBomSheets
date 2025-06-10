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
		// Index as "ITEM GROUP" + " ASSY" or "ITEM GROUP" + " MFG"
		[itemGroup: string]: {
			ItemCode: string;
			Quantity: number | undefined; // if it has a quantity, it's a Resource, otherwise it's a RouteStage
		}[];
	};
	ittItems: {
		ParentKey: string;
		ItemCode: string;
		Quanity: string;
	}[];
}

export function setup(): Data {
	throw new Error("Not implemented");
}
