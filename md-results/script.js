const csvData = `jurisdiction,harris,trump,oliver,stein,kennedy,others,total
Allegany,9231,22141,130,136,363,136,32137
Anne Arundel,171945,128892,2141,2429,3375,2790,311572
Baltimore City,195109,27984,892,3222,1875,1672,230754
Baltimore County,249958,149560,2240,4195,3858,3104,412915
Calvert,23438,29361,297,232,554,309,54191
Caroline,4860,11053,84,99,180,54,16330
Carroll,36867,62273,845,629,1182,855,102651
Cecil,17628,33871,291,286,536,219,52831
Charles,63454,26145,334,828,889,447,92097
Dorchester,6954,9390,57,138,191,42,16772
Frederick,82409,68753,970,1378,1494,1110,156114
Garrett,3456,11983,75,48,223,53,15838
Harford,62453,83050,1023,935,1559,1070,150090
Howard,124764,49425,1246,3341,1712,1803,182291
Kent,5251,5561,60,82,114,60,11128
Montgomery,386581,112637,2416,8009,4276,5302,519221
Prince George's,347038,45008,1038,5369,3428,2128,404009
Queen Anne's,11273,20200,174,153,336,211,32347
Saint Mary's,23531,33582,409,352,669,411,58954
Somerset,4054,5805,32,85,114,47,10137
Talbot,11119,11125,109,120,194,163,22830
Washington,27260,44054,363,513,811,331,73332
Wicomico,21513,24065,205,371,544,214,46912
Worcester,12431,19632,139,184,342,153,32881`;

const rows = csvData.trim().split('\n').map(row => row.split(','));
const headers = rows[0].slice(1);
const candidates = ['harris', 'trump', 'oliver', 'stein', 'kennedy', 'others'];

const candidateColors = {
  harris: '#007bff',
  trump: '#dc3545',
  oliver: '#ffc107',
  stein: '#28a745',
  kennedy: '#6f42c1',
  others: '#17a2b8'
};

const data = rows.slice(1).map(row => {
  const [county, ...values] = row;
  return {
    county,
    votes: headers.reduce((acc, candidate, i) => {
      acc[candidate] = parseInt(values[i]);
      return acc;
    }, {})
  };
});

// Calculate statewide totals
const statewideTotals = {};
headers.forEach(candidate => {
  statewideTotals[candidate] = data.reduce((sum, row) => sum + row.votes[candidate], 0);
});
const totalVotes = statewideTotals['total'];

// Populate statewide table
const statewideTable = document.querySelector('#statewide-table tbody');
candidates.forEach(candidate => {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${capitalize(candidate)}</td>
    <td>${statewideTotals[candidate]}</td>
    <td>${((statewideTotals[candidate] / totalVotes) * 100).toFixed(2)}%</td>
  `;
  statewideTable.appendChild(tr);
});

// Statewide chart
const statewideCtx = document.getElementById('statewideChart').getContext('2d');
const statewideChart = new Chart(statewideCtx, {
  type: 'bar',
  data: {
    labels: candidates.map(capitalize),
    datasets: [{
      label: 'Statewide %',
      data: candidates.map(c => (statewideTotals[c] / totalVotes * 100).toFixed(2)),
      backgroundColor: candidates.map(c => candidateColors[c])
    }]
  },
  options: {
    scales: { y: { beginAtZero: true, max: 100 } }
  }
});

// County dropdown
const select = document.getElementById('county-select');
data.forEach(row => {
  const option = document.createElement('option');
  option.value = row.county;
  option.textContent = row.county;
  select.appendChild(option);
});

const countyTable = document.querySelector('#county-table');
const countyTableBody = countyTable.querySelector('tbody');
const countyChartCanvas = document.getElementById('countyChart');
const countyCtx = countyChartCanvas.getContext('2d');
let countyChart = null;

select.addEventListener('change', () => {
  const selected = select.value;
  if (!selected) {
    countyTable.style.display = 'none';
    countyChartCanvas.style.display = 'none';
    return;
  }

  const countyData = data.find(d => d.county === selected);
  const total = countyData.votes.total;

  countyTableBody.innerHTML = '';
  candidates.forEach(candidate => {
    const vote = countyData.votes[candidate];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${capitalize(candidate)}</td>
      <td>${vote}</td>
      <td>${((vote / total) * 100).toFixed(2)}%</td>
    `;
    countyTableBody.appendChild(tr);
  });
  countyTable.style.display = 'table';

  const percentages = candidates.map(c => (countyData.votes[c] / total * 100).toFixed(2));
  const chartData = {
    labels: candidates.map(capitalize),
    datasets: [{
      label: `${selected} %`,
      data: percentages,
      backgroundColor: candidates.map(c => candidateColors[c])
    }]
  };

  if (countyChart) countyChart.destroy();
  countyChart = new Chart(countyCtx, {
    type: 'bar',
    data: chartData,
    options: {
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });

  countyChartCanvas.style.display = 'block';
});

// CHOROPLETH MAP
const map = L.map('map').setView([39.0, -76.7], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Load Maryland counties GeoJSON
fetch('md-counties.geojson') // Make sure this file is in your project
  .then(res => res.json())
  .then(geojson => {
    const countyVoteMap = {};
    data.forEach(row => {
      const votes = row.votes;
      const winner = candidates.reduce((max, c) =>
        votes[c] > votes[max] ? c : max, candidates[0]);
      countyVoteMap[row.county.toLowerCase()] = {
        winner,
        percent: ((votes[winner] / votes.total) * 100).toFixed(1)
      };
    });

    L.geoJson(geojson, {
      style: feature => {
        const name = feature.properties.NAME.toLowerCase();
        const voteInfo = countyVoteMap[name];
        return {
          fillColor: voteInfo ? candidateColors[voteInfo.winner] : '#ccc',
          color: '#555',
          weight: 1,
          fillOpacity: 0.7
        };
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties.NAME.toLowerCase();
        const voteInfo = countyVoteMap[name];
        if (voteInfo) {
          const popupText = `<strong>${capitalize(name)}</strong><br>
            Winner: ${capitalize(voteInfo.winner)}<br>
            ${voteInfo.percent}%`;
          layer.bindPopup(popupText);
        }
      }
    }).addTo(map);
  });

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}