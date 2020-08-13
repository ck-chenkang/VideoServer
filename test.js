var myMap = new Map();
myMap.set("1", "10");
myMap.set("2", "20");
myMap.set("3", "30");
myMap.set("4", "40");
myMap.set("5", "50");
myMap.set("6", "60");
myMap.set("7", "70");
myMap.set("8", "80");
myMap.set("9", "90");

console.log(myMap.keys());
Array.from(myMap.keys()).forEach(Element=>{
    console.log(Element);
})