some random stuff

Create these csv files in the ./data folder from where you run the script

data/all-items.csv

```csv
#,ITEM GROUP,PN#,DESCRIPTION,STOCK,COST,ALLOCATED,ON ORDER,MRP,MAKE / BUY,Active,BOM Type,Drawing,Drawing Rev Level,Drawing No Data,Serial No. Management
```

data/itt-items.csv

```csv
ParentKey,LineNum,ItemCode,Quantity,Warehouse,Price,Currency,IssueMethod
```

data/route-stages-and-resources.csv

```csv
Item Groups - Type,ItemCode,Quantity,Description,,

```

data/route-stages-numbers.csv

```csv
Internal Number,Code,Description

```

Output will be in ./data/output/

```shell
tree ./data/output/
./data/output/
├── bom.csv
├── route-stages.csv
└── tree-codes.csv
```
