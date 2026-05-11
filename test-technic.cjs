fetch('https://api.technicpack.net/search?q=tekkit&build=999&limit=100')
.then(r => r.json())
.then(data => {
  console.log('Keys:', Object.keys(data));
  console.log('Limit 100 length:', data.modpacks.length);
})
