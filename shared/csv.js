function downloadAsCsv(tabularData, fields) {
  // Download as CSV.
  // Note that to enable using extension, we need to add `downloads` permission.
  const blob = new Blob([jsonToCSV(tabularData, fields)], {
    type: "text/csv;charset=utf-8;",
  });

  if (navigator.msSaveBlob) {
    // Internet Explorer 10+ support.
    navigator.msSaveBlob(blob, "list_users.csv");
  } else {
    // Other browsers.
    const link = document.createElement("a");

    // Create a "hidden" element that we are going to click to download the CSV file.
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "list_users.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}

function jsonToCSV(json, fields) {
  let csvStr = fields.join(",") + "\n";

  json.forEach((element) => {
    const row = fields.map((key) => `"${element[key]}"`);

    csvStr += row.join(",") + "\n";
  });

  return csvStr;
}
