function downloadAsCsv(tabularData, fields, label = "") {
  // Download as CSV.
  // Note that to enable using extension, we need to add `downloads` permission.
  const blob = new Blob([jsonToCSV(tabularData, fields)], {
    type: "text/csv;charset=utf-8;",
  });
  const date = new Date();
  const name = `list_users_${label}_${pad(date.getFullYear())}${pad(
    date.getMonth()
  )}${pad(date.getDate())}`;

  if (navigator.msSaveBlob) {
    // Internet Explorer 10+ support.
    navigator.msSaveBlob(blob, name);
  } else {
    // Other browsers.
    const link = document.createElement("a");

    // Create a "hidden" element that we are going to click to download the CSV file.
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", name);
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

function pad(num) {
  const str = `${num}`;
  return str.padStart(2, "0");
}
