const pending = new Set();

RegisterCommand('dumpclothing', (source) => {
    if (source === 0) {
        console.log('Run this command in game.');
        return;
    }
    pending.add(source);
    emitNet('clothing_dump:start', source);
}, true);

onNet('clothing_dump:result', (data) => {
    const src = global.source;
    if (!pending.has(src)) return;
    pending.delete(src);

    const output = JSON.stringify(data, null, 2);
    SaveResourceFile(GetCurrentResourceName(), 'clothing_names.json', output, -1);
    console.log(`Saved clothing_names.json (${output.length} bytes)`);
});
