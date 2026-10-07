const GET_SHOP_PED_COMPONENT = '0x74C0E2A57EC66760';
const GET_SHOP_PED_PROP = '0x5D5CAFF661DDF6FC';
const SHOP_ITEM_SIZE = 0x88;
const SHOP_ITEM_LABEL_OFFSET = 0x48;
const BASE_COLLECTION = 'base';

const MODELS = {
    male: 'mp_m_freemode_01',
    female: 'mp_f_freemode_01',
};

const COMPONENTS = {
    0: 'head', 1: 'masks', 2: 'hair', 3: 'arms', 4: 'pants', 5: 'bags',
    6: 'shoes', 7: 'accessories', 8: 'undershirts', 9: 'armor', 10: 'decals', 11: 'jackets',
};

const PROPS = {
    0: 'hats', 1: 'glasses', 2: 'ears', 6: 'watches', 7: 'bracelets',
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readShopLabel(native, hash) {
    const buffer = new Uint8Array(SHOP_ITEM_SIZE);
    Citizen.invokeNative(native, hash, buffer);

    let label = '';
    for (let i = SHOP_ITEM_LABEL_OFFSET; i < SHOP_ITEM_SIZE && buffer[i] !== 0; i++) {
        label += String.fromCharCode(buffer[i]);
    }
    return label || null;
}

function makeEntry(native, index, localIndex, texture, hash) {
    const entry = { index, localIndex, texture };
    if (hash === 0) return entry;

    entry.hash = hash;
    entry.label = readShopLabel(native, hash);
    if (entry.label) {
        const text = GetLabelText(entry.label);
        if (text && text !== 'NULL') entry.name = text;
    }
    return entry;
}

async function setModel(model) {
    RequestModel(model);
    while (!HasModelLoaded(model)) await delay(0);
    SetPlayerModel(PlayerId(), model);
    SetModelAsNoLongerNeeded(model);
    const ped = PlayerPedId();
    SetPedDefaultComponentVariation(ped);
    return ped;
}

function addItem(result, collection, category, id, isProp, entry) {
    result[collection] ??= {};
    result[collection][category] ??= { id, isProp, items: [] };
    result[collection][category].items.push(entry);
}

async function dumpSlots(ped, result, slots, isProp) {
    const native = isProp ? GET_SHOP_PED_PROP : GET_SHOP_PED_COMPONENT;

    for (const [key, category] of Object.entries(slots)) {
        const id = Number(key);
        const drawables = isProp
            ? GetNumberOfPedPropDrawableVariations(ped, id)
            : GetNumberOfPedDrawableVariations(ped, id);

        for (let index = 0; index < drawables; index++) {
            const collection = (isProp
                ? GetPedCollectionNameFromProp(ped, id, index)
                : GetPedCollectionNameFromDrawable(ped, id, index)) || BASE_COLLECTION;
            const localIndex = isProp
                ? GetPedCollectionLocalIndexFromProp(ped, id, index)
                : GetPedCollectionLocalIndexFromDrawable(ped, id, index);
            const textures = isProp
                ? GetNumberOfPedPropTextureVariations(ped, id, index)
                : GetNumberOfPedTextureVariations(ped, id, index);

            for (let texture = 0; texture < textures; texture++) {
                const hash = isProp
                    ? GetHashNameForProp(ped, id, index, texture)
                    : GetHashNameForComponent(ped, id, index, texture);
                addItem(result, collection, category, id, isProp, makeEntry(native, index, localIndex, texture, hash));
            }

            if (index % 25 === 0) await delay(0);
        }
    }
}

function sortItems(result) {
    for (const categories of Object.values(result)) {
        for (const category of Object.values(categories)) {
            category.items.sort((a, b) => a.index - b.index || a.texture - b.texture);
        }
    }
}

onNet('clothing_dump:start', async () => {
    const originalModel = GetEntityModel(PlayerPedId());
    const data = {};

    for (const [gender, model] of Object.entries(MODELS)) {
        console.log(`Dumping ${gender} clothing...`);
        const ped = await setModel(GetHashKey(model));
        const result = {};
        await dumpSlots(ped, result, COMPONENTS, false);
        await dumpSlots(ped, result, PROPS, true);
        sortItems(result);
        data[gender] = result;
    }

    await setModel(originalModel);
    console.log('Sending clothing dump to the server...');
    TriggerLatentServerEvent('clothing_dump:result', 1000000, data);
});
