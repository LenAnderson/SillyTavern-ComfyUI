import {
    saveSettingsDebounced,
    systemUserName,
    hideSwipeButtons,
    showSwipeButtons,
    callPopup,
    getRequestHeaders,
    event_types,
    eventSource,
    appendImageToMessage,
    generateQuietPrompt,
    this_chid,
    getCurrentChatId,
} from "../../../../script.js";
import { getApiUrl, getContext, extension_settings, doExtrasFetch, modules, renderExtensionTemplate } from "../../../extensions.js";
import { selected_group } from "../../../group-chats.js";
import { stringFormat, initScrollHeight, resetScrollHeight, getCharaFilename, saveBase64AsFile } from "../../../utils.js";
import { getMessageTimeStamp, humanizedDateTime } from "../../../RossAscends-mods.js";
import { SECRET_KEYS, secret_state } from "../../../secrets.js";
import { getNovelUnlimitedImageGeneration, getNovelAnlas, loadNovelSubscriptionData } from "../../../nai-settings.js";
export { MODULE_NAME };

// Wraps a string into monospace font-face span
const m = x => `<span class="monospace">${x}</span>`;
// Joins an array of strings with ' / '
const j = a => a.join(' / ');
// Wraps a string into paragraph block
const p = a => `<p>${a}</p>`

const MODULE_NAME = 'comfy';
const UPDATE_INTERVAL = 1000;

const sources = {
    comfy: 'comfy',
}

const generationMode = {
    CHARACTER: 0,
    USER: 1,
    SCENARIO: 2,
    RAW_LAST: 3,
    NOW: 4,
    FACE: 5,
    FREE: 6,
    BACKGROUND: 7,
}

const modeLabels = {
    [generationMode.CHARACTER]: 'Character ("Yourself")',
    [generationMode.FACE]: 'Portrait ("Your Face")',
    [generationMode.USER]: 'User ("Me")',
    [generationMode.SCENARIO]: 'Scenario ("The Whole Story")',
    [generationMode.NOW]: 'Last Message',
    [generationMode.RAW_LAST]: 'Raw Last Message',
    [generationMode.BACKGROUND]: 'Background',
}

const triggerWords = {
    [generationMode.CHARACTER]: ['you'],
    [generationMode.USER]: ['me'],
    [generationMode.SCENARIO]: ['scene'],
    [generationMode.RAW_LAST]: ['raw_last'],
    [generationMode.NOW]: ['last'],
    [generationMode.FACE]: ['face'],
    [generationMode.BACKGROUND]: ['background'],
}

const promptTemplates = {
    /*OLD:     [generationMode.CHARACTER]: "Pause your roleplay and provide comma-delimited list of phrases and keywords which describe {{char}}'s physical appearance and clothing. Ignore {{char}}'s personality traits, and chat history when crafting this description. End your response once the comma-delimited list is complete. Do not roleplay when writing this description, and do not attempt to continue the story.", */
    [generationMode.CHARACTER]: "[In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, clothing, occupation, physical features and appearances. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'full body portrait,']",
    //face-specific prompt
    [generationMode.FACE]: "[In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, facial features and expressions, occupation, hair and hair accessories (if any), what they are wearing on their upper body (if anything). Do not describe anything below their neck. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'close up facial portrait,']",
    //prompt for only the last message
    [generationMode.USER]: "[Pause your roleplay and provide a detailed description of {{user}}'s physical appearance from the perspective of {{char}} in the form of a comma-delimited list of keywords and phrases. The list must include all of the following items in this order: name, species and race, gender, age, clothing, occupation, physical features and appearances. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'full body portrait,'. Ignore the rest of the story when crafting this description. Do not roleplay as {{char}} when writing this description, and do not attempt to continue the story.]",
    [generationMode.SCENARIO]: "[Pause your roleplay and provide a detailed description for all of the following: a brief recap of recent events in the story, {{char}}'s appearance, and {{char}}'s surroundings. Do not roleplay while writing this description.]",

    [generationMode.NOW]: `[Pause your roleplay. Your next response must be formatted as a single comma-delimited list of concise keywords.  The list will describe of the visual details included in the last chat message.

    Only mention characters by using pronouns ('he','his','she','her','it','its') or neutral nouns ('male', 'the man', 'female', 'the woman').

    Ignore non-visible things such as feelings, personality traits, thoughts, and spoken dialog.

    Add keywords in this precise order:
    a keyword to describe the location of the scene,
    a keyword to mention how many characters of each gender or type are present in the scene (minimum of two characters:
    {{user}} and {{char}}, example: '2 men ' or '1 man 1 woman ', '1 man 3 robots'),

    keywords to describe the relative physical positioning of the characters to each other (if a commonly known term for the positioning is known use it instead of describing the positioning in detail) + 'POV',

    a single keyword or phrase to describe the primary act taking place in the last chat message,

    keywords to describe {{char}}'s physical appearance and facial expression,
    keywords to describe {{char}}'s actions,
    keywords to describe {{user}}'s physical appearance and actions.

    If character actions involve direct physical interaction with another character, mention specifically which body parts interacting and how.

    A correctly formatted example response would be:
    '(location),(character list by gender),(primary action), (relative character position) POV, (character 1's description and actions), (character 2's description and actions)']`,

    [generationMode.RAW_LAST]: "[Pause your roleplay and provide ONLY the last chat message string back to me verbatim. Do not write anything after the string. Do not roleplay at all in your response. Do not continue the roleplay story.]",
    [generationMode.BACKGROUND]: "[Pause your roleplay and provide a detailed description of {{char}}'s surroundings in the form of a comma-delimited list of keywords and phrases. The list must include all of the following items in this order: location, time of day, weather, lighting, and any other relevant details. Do not include descriptions of characters and non-visual qualities such as names, personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'background,'. Ignore the rest of the story when crafting this description. Do not roleplay as {{user}} when writing this description, and do not attempt to continue the story.]",
}

const helpString = [
    `${m('(argument)')} – requests SD to make an image. Supported arguments:`,
    '<ul>',
    `<li>${m(j(triggerWords[generationMode.CHARACTER]))} – AI character full body selfie</li>`,
    `<li>${m(j(triggerWords[generationMode.FACE]))} – AI character face-only selfie</li>`,
    `<li>${m(j(triggerWords[generationMode.USER]))} – user character full body selfie</li>`,
    `<li>${m(j(triggerWords[generationMode.SCENARIO]))} – visual recap of the whole chat scenario</li>`,
    `<li>${m(j(triggerWords[generationMode.NOW]))} – visual recap of the last chat message</li>`,
    `<li>${m(j(triggerWords[generationMode.RAW_LAST]))} – visual recap of the last chat message with no summary</li>`,
    `<li>${m(j(triggerWords[generationMode.BACKGROUND]))} – generate a background for this chat based on the chat's context</li>`,
    '</ul>',
    `Anything else would trigger a "free mode" to make SD generate whatever you prompted.<Br>
    example: '/sd apple tree' would generate a picture of an apple tree.`,
].join('<br>');

const defaultSettings = {
    source: sources.comfy,

    // CFG Scale
    scale_min: 1,
    scale_max: 30,
    scale_step: 0.5,
    scale: 7,

    // Sampler steps
    steps_min: 1,
    steps_max: 150,
    steps_step: 1,
    steps: 20,

    // Image dimensions (Width & Height)
    dimension_min: 64,
    dimension_max: 2048,
    dimension_step: 64,
    width: 512,
    height: 512,

    prompt_prefix: 'best quality, absurdres, masterpiece,',
    negative_prompt: 'lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
    sampler: 'DDIM',
    model: '',

    // Automatic1111/Horde exclusives
    restore_faces: false,
    enable_hr: false,

    // Horde settings
    horde: false,
    horde_nsfw: false,
    horde_karras: true,

    // Refine mode
    refine_mode: false,

    prompts: promptTemplates,

    // AUTOMATIC1111 settings
    auto_url: 'http://localhost:7860',
    auto_auth: '',

    hr_upscaler: 'Latent',
    hr_scale: 2.0,
    hr_scale_min: 1.0,
    hr_scale_max: 4.0,
    hr_scale_step: 0.1,
    denoising_strength: 0.7,
    denoising_strength_min: 0.0,
    denoising_strength_max: 1.0,
    denoising_strength_step: 0.01,
    hr_second_pass_steps: 0,
    hr_second_pass_steps_min: 0,
    hr_second_pass_steps_max: 150,
    hr_second_pass_steps_step: 1,

    // NovelAI settings
    novel_upscale_ratio_min: 1.0,
    novel_upscale_ratio_max: 4.0,
    novel_upscale_ratio_step: 0.1,
    novel_upscale_ratio: 1.0,
    novel_anlas_guard: false,

    // ComfyUI settings
    comfy_url: 'http://127.0.0.1:8188',
    comfy_workflow: `{
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "cfg": "%scale%",
                "denoise": 1,
                "latent_image": [
                    "5",
                    0
                ],
                "model": [
                    "4",
                    0
                ],
                "negative": [
                    "7",
                    0
                ],
                "positive": [
                    "6",
                    0
                ],
                "sampler_name": "euler",
                "scheduler": "normal",
                "seed": 8566257,
                "steps": "%steps%"
            }
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {
                "ckpt_name": "astreapixieRadiance_v16.safetensors"
            }
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {
                "batch_size": 1,
                "height": "%height%",
                "width": "%width%"
            }
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "clip": [
                    "4",
                    1
                ],
                "text": "%prompt%"
            }
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {
                "clip": [
                    "4",
                    1
                ],
                "text": "%negative_prompt%"
            }
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {
                "samples": [
                    "3",
                    0
                ],
                "vae": [
                    "4",
                    2
                ]
            }
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {
                "filename_prefix": "SillyTavern",
                "images": [
                    "8",
                    0
                ]
            }
        }
    }`,
}

const getAutoRequestBody = () => ({ url: extension_settings.comfy.auto_url, auth: extension_settings.comfy.auto_auth });

function toggleSourceControls() {
    $('.sd_settings [data-comfy-source]').each(function () {
        const source = $(this).data('comfy-source');
        $(this).toggle(source === extension_settings.comfy.source);
    });
}

async function loadSettings() {
    // Initialize settings
    if (!extension_settings.comfy) {
        extension_settings.comfy = {};
    }
    if (Object.keys(extension_settings.comfy).length === 0) {
        Object.assign(extension_settings.comfy, defaultSettings);
    }

    // Insert missing settings
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (extension_settings.comfy[key] === undefined) {
            extension_settings.comfy[key] = value;
        }
    }

    if (extension_settings.comfy.prompts === undefined) {
        extension_settings.comfy.prompts = promptTemplates;
    }

    // Insert missing templates
    for (const [key, value] of Object.entries(promptTemplates)) {
        if (extension_settings.comfy.prompts[key] === undefined) {
            extension_settings.comfy.prompts[key] = value;
        }
    }

    if (extension_settings.comfy.character_prompts === undefined) {
        extension_settings.comfy.character_prompts = {};
    }

    $('#comfy_source').val(extension_settings.comfy.source);
    $('#comfy_scale').val(extension_settings.comfy.scale).trigger('input');
    $('#comfy_steps').val(extension_settings.comfy.steps).trigger('input');
    $('#comfy_prompt_prefix').val(extension_settings.comfy.prompt_prefix).trigger('input');
    $('#comfy_negative_prompt').val(extension_settings.comfy.negative_prompt).trigger('input');
    $('#comfy_width').val(extension_settings.comfy.width).trigger('input');
    $('#comfy_height').val(extension_settings.comfy.height).trigger('input');
    $('#comfy_hr_scale').val(extension_settings.comfy.hr_scale).trigger('input');
    $('#comfy_denoising_strength').val(extension_settings.comfy.denoising_strength).trigger('input');
    $('#comfy_hr_second_pass_steps').val(extension_settings.comfy.hr_second_pass_steps).trigger('input');
    $('#comfy_novel_upscale_ratio').val(extension_settings.comfy.novel_upscale_ratio).trigger('input');
    $('#comfy_novel_anlas_guard').prop('checked', extension_settings.comfy.novel_anlas_guard);
    $('#comfy_horde').prop('checked', extension_settings.comfy.horde);
    $('#comfy_horde_nsfw').prop('checked', extension_settings.comfy.horde_nsfw);
    $('#comfy_horde_karras').prop('checked', extension_settings.comfy.horde_karras);
    $('#comfy_restore_faces').prop('checked', extension_settings.comfy.restore_faces);
    $('#comfy_enable_hr').prop('checked', extension_settings.comfy.enable_hr);
    $('#comfy_refine_mode').prop('checked', extension_settings.comfy.refine_mode);
    $('#comfy_auto_url').val(extension_settings.comfy.auto_url);
    $('#comfy_auto_auth').val(extension_settings.comfy.auto_auth);
    $('#comfy_comfy_url').val(extension_settings.comfy.comfy_url);
    $('#comfy_comfy_workflow').val(extension_settings.comfy.comfy_workflow);

    toggleSourceControls();
    addPromptTemplates();

    await Promise.all([loadSamplers(), loadModels()]);
}

function addPromptTemplates() {
    $('#comfy_prompt_templates').empty();

    for (const [name, prompt] of Object.entries(extension_settings.comfy.prompts)) {
        const label = $('<label></label>')
            .text(modeLabels[name])
            .attr('for', `comfy_prompt_${name}`);
        const textarea = $('<textarea></textarea>')
            .addClass('textarea_compact text_pole')
            .attr('id', `comfy_prompt_${name}`)
            .attr('rows', 6)
            .val(prompt).on('input', () => {
                extension_settings.comfy.prompts[name] = textarea.val();
                saveSettingsDebounced();
            });
        const button = $('<button></button>')
            .addClass('menu_button fa-solid fa-undo')
            .attr('title', 'Restore default')
            .on('click', () => {
                textarea.val(promptTemplates[name]);
                extension_settings.comfy.prompts[name] = promptTemplates[name];
                saveSettingsDebounced();
            });
        const container = $('<div></div>')
            .addClass('title_restorable')
            .append(label)
            .append(button)
        $('#comfy_prompt_templates').append(container);
        $('#comfy_prompt_templates').append(textarea);
    }
}

async function refinePrompt(prompt) {
    if (extension_settings.comfy.refine_mode) {
        const refinedPrompt = await callPopup('<h3>Review and edit the prompt:</h3>Press "Cancel" to abort the image generation.', 'input', prompt, { rows: 5, okButton: 'Generate' });

        if (refinedPrompt) {
            return refinedPrompt;
        } else {
            throw new Error('Generation aborted by user.');
        }
    }

    return prompt;
}

function onChatChanged() {
    if (this_chid === undefined || selected_group) {
        $('#comfy_character_prompt_block').hide();
        return;
    }

    $('#comfy_character_prompt_block').show();
    const key = getCharaFilename(this_chid);
    $('#comfy_character_prompt').val(key ? (extension_settings.comfy.character_prompts[key] || '') : '');
}

function onCharacterPromptInput() {
    const key = getCharaFilename(this_chid);
    extension_settings.comfy.character_prompts[key] = $('#comfy_character_prompt').val();
    resetScrollHeight($(this));
    saveSettingsDebounced();
}

function getCharacterPrefix() {
    if (selected_group) {
        return '';
    }

    const key = getCharaFilename(this_chid);

    if (key) {
        return extension_settings.comfy.character_prompts[key] || '';
    }

    return '';
}

function combinePrefixes(str1, str2) {
    if (!str2) {
        return str1;
    }

    // Remove leading/trailing white spaces and commas from the strings
    str1 = str1.trim().replace(/^,|,$/g, '');
    str2 = str2.trim().replace(/^,|,$/g, '');

    // Combine the strings with a comma between them
    var result = `${str1}, ${str2},`;

    return result;
}

function onRefineModeInput() {
    extension_settings.comfy.refine_mode = !!$('#comfy_refine_mode').prop('checked');
    saveSettingsDebounced();
}

function onScaleInput() {
    extension_settings.comfy.scale = Number($('#comfy_scale').val());
    $('#comfy_scale_value').text(extension_settings.comfy.scale.toFixed(1));
    saveSettingsDebounced();
}

function onStepsInput() {
    extension_settings.comfy.steps = Number($('#comfy_steps').val());
    $('#comfy_steps_value').text(extension_settings.comfy.steps);
    saveSettingsDebounced();
}

function onPromptPrefixInput() {
    extension_settings.comfy.prompt_prefix = $('#comfy_prompt_prefix').val();
    resetScrollHeight($(this));
    saveSettingsDebounced();
}

function onNegativePromptInput() {
    extension_settings.comfy.negative_prompt = $('#comfy_negative_prompt').val();
    resetScrollHeight($(this));
    saveSettingsDebounced();
}

function onSamplerChange() {
    extension_settings.comfy.sampler = $('#comfy_sampler').find(':selected').val();
    saveSettingsDebounced();
}

function onWidthInput() {
    extension_settings.comfy.width = Number($('#comfy_width').val());
    $('#comfy_width_value').text(extension_settings.comfy.width);
    saveSettingsDebounced();
}

function onHeightInput() {
    extension_settings.comfy.height = Number($('#comfy_height').val());
    $('#comfy_height_value').text(extension_settings.comfy.height);
    saveSettingsDebounced();
}

async function onSourceChange() {
    extension_settings.comfy.source = $('#comfy_source').find(':selected').val();
    extension_settings.comfy.model = null;
    extension_settings.comfy.sampler = null;
    toggleSourceControls();
    saveSettingsDebounced();
    await Promise.all([loadModels(), loadSamplers()]);
}

async function onViewAnlasClick() {
    const result = await loadNovelSubscriptionData();

    if (!result) {
        toastr.warning('Are you subscribed?', 'Could not load NovelAI subscription data');
        return;
    }

    const anlas = getNovelAnlas();
    const unlimitedGeneration = getNovelUnlimitedImageGeneration();

    toastr.info(`Free image generation: ${unlimitedGeneration ? 'Yes' : 'No'}`, `Anlas: ${anlas}`);
}

function onNovelUpscaleRatioInput() {
    extension_settings.comfy.novel_upscale_ratio = Number($('#comfy_novel_upscale_ratio').val());
    $('#comfy_novel_upscale_ratio_value').text(extension_settings.comfy.novel_upscale_ratio.toFixed(1));
    saveSettingsDebounced();
}

function onNovelAnlasGuardInput() {
    extension_settings.comfy.novel_anlas_guard = !!$('#comfy_novel_anlas_guard').prop('checked');
    saveSettingsDebounced();
}

async function onHordeNsfwInput() {
    extension_settings.comfy.horde_nsfw = !!$(this).prop('checked');
    saveSettingsDebounced();
}

async function onHordeKarrasInput() {
    extension_settings.comfy.horde_karras = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onRestoreFacesInput() {
    extension_settings.comfy.restore_faces = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onHighResFixInput() {
    extension_settings.comfy.enable_hr = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onAutoUrlInput() {
    extension_settings.comfy.auto_url = $('#comfy_auto_url').val();
    saveSettingsDebounced();
}

function onAutoAuthInput() {
    extension_settings.comfy.auto_auth = $('#comfy_auto_auth').val();
    saveSettingsDebounced();
}

function onHrUpscalerChange() {
    extension_settings.comfy.hr_upscaler = $('#comfy_hr_upscaler').find(':selected').val();
    saveSettingsDebounced();
}

function onHrScaleInput() {
    extension_settings.comfy.hr_scale = Number($('#comfy_hr_scale').val());
    $('#comfy_hr_scale_value').text(extension_settings.comfy.hr_scale.toFixed(1));
    saveSettingsDebounced();
}

function onDenoisingStrengthInput() {
    extension_settings.comfy.denoising_strength = Number($('#comfy_denoising_strength').val());
    $('#comfy_denoising_strength_value').text(extension_settings.comfy.denoising_strength.toFixed(2));
    saveSettingsDebounced();
}

function onHrSecondPassStepsInput() {
    extension_settings.comfy.hr_second_pass_steps = Number($('#comfy_hr_second_pass_steps').val());
    $('#comfy_hr_second_pass_steps_value').text(extension_settings.comfy.hr_second_pass_steps);
    saveSettingsDebounced();
}

function onComfyUrlInput() {
    extension_settings.comfy.comfy_url = $('#comfy_comfy_url').val();
    saveSettingsDebounced();
}
function onComfyWorkflowInput() {
    extension_settings.comfy.comfy_workflow = $('#comfy_comfy_workflow').val();
    saveSettingsDebounced();
}

async function validateAutoUrl() {
    try {
        if (!extension_settings.comfy.auto_url) {
            throw new Error('URL is not set.');
        }

        const result = await fetch('/api/sd/ping', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getAutoRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        await loadSamplers();
        await loadModels();
        toastr.success('SD WebUI API connected.');
    } catch (error) {
        toastr.error(`Could not validate SD WebUI API: ${error.message}`);
    }
}

async function onModelChange() {
    extension_settings.comfy.model = $('#comfy_model').find(':selected').val();
    saveSettingsDebounced();

    const cloudSources = [sources.horde, sources.novel];

    if (cloudSources.includes(extension_settings.comfy.source)) {
        return;
    }

    toastr.info('Updating remote model...', 'Please wait');
    if (extension_settings.comfy.source === sources.extras) {
        await updateExtrasRemoteModel();
    }
    if (extension_settings.comfy.source === sources.auto) {
        await updateAutoRemoteModel();
    }
    toastr.success('Model successfully loaded!', 'Stable Diffusion');
}

async function getAutoRemoteModel() {
    try {
        const result = await fetch('/api/sd/get-model', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getAutoRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const data = await result.text();
        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getAutoRemoteUpscalers() {
    try {
        const result = await fetch('/api/sd/upscalers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getAutoRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const data = await result.json();
        return data;
    } catch (error) {
        console.error(error);
        return [extension_settings.comfy.hr_upscaler];
    }
}

async function updateAutoRemoteModel() {
    try {
        const result = await fetch('/api/sd/set-model', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ ...getAutoRequestBody(), model: extension_settings.comfy.model }),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        console.log('Model successfully updated on SD WebUI remote.');
    } catch (error) {
        console.error(error);
        toastr.error(`Could not update SD WebUI model: ${error.message}`);
    }
}

async function updateExtrasRemoteModel() {
    const url = new URL(getApiUrl());
    url.pathname = '/api/image/model';
    const getCurrentModelResult = await doExtrasFetch(url, {
        method: 'POST',
        body: JSON.stringify({ model: extension_settings.comfy.model }),
    });

    if (getCurrentModelResult.ok) {
        console.log('Model successfully updated on SD remote.');
    }
}

async function loadSamplers() {
    $('#comfy_sampler').empty();
    let samplers = [];

    switch (extension_settings.comfy.source) {
        case sources.extras:
            samplers = await loadExtrasSamplers();
            break;
        case sources.horde:
            samplers = await loadHordeSamplers();
            break;
        case sources.auto:
            samplers = await loadAutoSamplers();
            break;
        case sources.novel:
            samplers = await loadNovelSamplers();
            break;
        case sources.comfy:
            samplers = ['configure sampler in json template'];
            break;
    }

    for (const sampler of samplers) {
        const option = document.createElement('option');
        option.innerText = sampler;
        option.value = sampler;
        option.selected = sampler === extension_settings.comfy.sampler;
        $('#comfy_sampler').append(option);
    }
}

async function loadHordeSamplers() {
    const result = await fetch('/api/horde/sd-samplers', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    if (result.ok) {
        const data = await result.json();
        return data;
    }

    return [];
}

async function loadExtrasSamplers() {
    if (!modules.includes('sd')) {
        return [];
    }

    const url = new URL(getApiUrl());
    url.pathname = '/api/image/samplers';
    const result = await doExtrasFetch(url);

    if (result.ok) {
        const data = await result.json();
        return data.samplers;
    }

    return [];
}

async function loadAutoSamplers() {
    if (!extension_settings.comfy.auto_url) {
        return [];
    }

    try {
        const result = await fetch('/api/sd/samplers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getAutoRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const data = await result.json();
        return data;
    } catch (error) {
        return [];
    }
}

async function loadNovelSamplers() {
    if (!secret_state[SECRET_KEYS.NOVEL]) {
        console.debug('NovelAI API key is not set.');
        return [];
    }

    return [
        'k_dpmpp_2m',
        'k_dpmpp_sde',
        'k_dpmpp_2s_ancestral',
        'k_euler',
        'k_euler_ancestral',
        'k_dpm_fast',
        'ddim',
    ];
}

async function loadModels() {
    $('#comfy_model').empty();
    let models = [];

    switch (extension_settings.comfy.source) {
        case sources.extras:
            models = await loadExtrasModels();
            break;
        case sources.horde:
            models = await loadHordeModels();
            break;
        case sources.auto:
            models = await loadAutoModels();
            break;
        case sources.novel:
            models = await loadNovelModels();
            break;
        case sources.comfy:
            models = [{value:'JSON', text:'configure model in template json'}];
            break;
    }

    for (const model of models) {
        const option = document.createElement('option');
        option.innerText = model.text;
        option.value = model.value;
        option.selected = model.value === extension_settings.comfy.model;
        $('#comfy_model').append(option);
    }
}

async function loadHordeModels() {
    const result = await fetch('/api/horde/sd-models', {
        method: 'POST',
        headers: getRequestHeaders(),
    });


    if (result.ok) {
        const data = await result.json();
        data.sort((a, b) => b.count - a.count);
        const models = data.map(x => ({ value: x.name, text: `${x.name} (ETA: ${x.eta}s, Queue: ${x.queued}, Workers: ${x.count})` }));
        return models;
    }

    return [];
}

async function loadExtrasModels() {
    if (!modules.includes('sd')) {
        return [];
    }

    const url = new URL(getApiUrl());
    url.pathname = '/api/image/model';
    const getCurrentModelResult = await doExtrasFetch(url);

    if (getCurrentModelResult.ok) {
        const data = await getCurrentModelResult.json();
        extension_settings.comfy.model = data.model;
    }

    url.pathname = '/api/image/models';
    const getModelsResult = await doExtrasFetch(url);

    if (getModelsResult.ok) {
        const data = await getModelsResult.json();
        const view_models = data.models.map(x => ({ value: x, text: x }));
        return view_models;
    }

    return [];
}

async function loadAutoModels() {
    if (!extension_settings.comfy.auto_url) {
        return [];
    }

    try {
        const currentModel = await getAutoRemoteModel();

        if (currentModel) {
            extension_settings.comfy.model = currentModel;
        }

        const result = await fetch('/api/sd/models', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getAutoRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const upscalers = await getAutoRemoteUpscalers();

        if (Array.isArray(upscalers) && upscalers.length > 0) {
            $('#comfy_hr_upscaler').empty();

            for (const upscaler of upscalers) {
                const option = document.createElement('option');
                option.innerText = upscaler;
                option.value = upscaler;
                option.selected = upscaler === extension_settings.comfy.hr_upscaler;
                $('#comfy_hr_upscaler').append(option);
            }
        }

        const data = await result.json();
        return data;
    } catch (error) {
        return [];
    }
}

async function loadNovelModels() {
    if (!secret_state[SECRET_KEYS.NOVEL]) {
        console.debug('NovelAI API key is not set.');
        return [];
    }

    return [
        {
            value: 'nai-diffusion',
            text: 'Full',
        },
        {
            value: 'safe-diffusion',
            text: 'Safe',
        },
        {
            value: 'nai-diffusion-furry',
            text: 'Furry',
        },
    ];
}

function getGenerationType(prompt) {
    for (const [key, values] of Object.entries(triggerWords)) {
        for (const value of values) {
            if (value.toLowerCase() === prompt.toLowerCase().trim()) {
                return Number(key);
            }
        }
    }

    return generationMode.FREE;
}

function getQuietPrompt(mode, trigger) {
    if (mode === generationMode.FREE) {
        return trigger;
    }

    return stringFormat(extension_settings.comfy.prompts[mode], trigger);
}

function processReply(str) {
    if (!str) {
        return '';
    }

    str = str.replaceAll('"', '')
    str = str.replaceAll('“', '')
    str = str.replaceAll('.', ',')
    str = str.replaceAll('\n', ', ')
    str = str.replace(/[^a-zA-Z0-9,:()]+/g, ' ') // Replace everything except alphanumeric characters and commas with spaces
    str = str.replace(/\s+/g, ' '); // Collapse multiple whitespaces into one
    str = str.trim();

    str = str
        .split(',') // list split by commas
        .map(x => x.trim()) // trim each entry
        .filter(x => x) // remove empty entries
        .join(', '); // join it back with proper spacing

    return str;
}

function getRawLastMessage() {
    const getLastUsableMessage = () => {
        for (const message of context.chat.slice().reverse()) {
            if (message.is_system) {
                continue;
            }

            return message.mes;
        }

        toastr.warning('No usable messages found.', 'Stable Diffusion');
        throw new Error('No usable messages found.');
    }

    const context = getContext();
    const lastMessage = getLastUsableMessage(),
        characterDescription = context.characters[context.characterId].description,
        situation = context.characters[context.characterId].scenario;
    return `((${processReply(lastMessage)})), (${processReply(situation)}:0.7), (${processReply(characterDescription)}:0.5)`
}

async function generatePicture(_, trigger, message, callback) {
    if (!trigger || trigger.trim().length === 0) {
        console.log('Trigger word empty, aborting');
        return;
    }

    if (!isValidState()) {
        toastr.warning("Extensions API is not connected or doesn't provide SD module. Enable Stable Horde to generate images.");
        return;
    }

    extension_settings.comfy.sampler = $('#comfy_sampler').find(':selected').val();
    extension_settings.comfy.model = $('#comfy_model').find(':selected').val();

    trigger = trigger.trim();
    const generationType = getGenerationType(trigger);
    console.log('Generation mode', generationType, 'triggered with', trigger);
    const quiet_prompt = getQuietPrompt(generationType, trigger);
    const context = getContext();

    // if context.characterId is not null, then we get context.characters[context.characterId].avatar, else we get groupId and context.groups[groupId].id
    // sadly, groups is not an array, but is a dict with keys being index numbers, so we have to filter it
    const characterName = context.characterId ? context.characters[context.characterId].name : context.groups[Object.keys(context.groups).filter(x => context.groups[x].id === context.groupId)[0]].id.toString();

    const prevSDHeight = extension_settings.comfy.height;
    const prevSDWidth = extension_settings.comfy.width;
    const aspectRatio = extension_settings.comfy.width / extension_settings.comfy.height;

    // Face images are always portrait (pun intended)
    if (generationType == generationMode.FACE && aspectRatio >= 1) {
        // Round to nearest multiple of 64
        extension_settings.comfy.height = Math.round(extension_settings.comfy.width * 1.5 / 64) * 64;
    }

    if (generationType == generationMode.BACKGROUND) {
        // Background images are always landscape
        if (aspectRatio <= 1) {
            // Round to nearest multiple of 64
            extension_settings.comfy.width = Math.round(extension_settings.comfy.height * 1.8 / 64) * 64;
        }
        const callbackOriginal = callback;
        callback = async function (prompt, base64Image) {
            const imagePath = base64Image;
            const imgUrl = `url("${encodeURI(base64Image)}")`;
            eventSource.emit(event_types.FORCE_SET_BACKGROUND, imgUrl);

            if (typeof callbackOriginal === 'function') {
                callbackOriginal(prompt, imagePath);
            } else {
                sendMessage(prompt, imagePath);
            }
        }
    }

    try {
        const prompt = await getPrompt(generationType, message, trigger, quiet_prompt);
        console.log('Processed Stable Diffusion prompt:', prompt);

        context.deactivateSendButtons();
        hideSwipeButtons();

        await sendGenerationRequest(generationType, prompt, characterName, callback);
    } catch (err) {
        console.trace(err);
        throw new Error('SD prompt text generation failed.')
    }
    finally {
        extension_settings.comfy.height = prevSDHeight;
        extension_settings.comfy.width = prevSDWidth;
        context.activateSendButtons();
        showSwipeButtons();
    }
}

async function getPrompt(generationType, message, trigger, quiet_prompt) {
    let prompt;

    switch (generationType) {
        case generationMode.RAW_LAST:
            prompt = message || getRawLastMessage();
            break;
        case generationMode.FREE:
            prompt = trigger.trim();
            break;
        default:
            prompt = await generatePrompt(quiet_prompt);
            break;
    }

    if (generationType !== generationMode.FREE) {
        prompt = await refinePrompt(prompt);
    }

    return prompt;
}

async function generatePrompt(quiet_prompt) {
    const reply = await generateQuietPrompt(quiet_prompt);
    return processReply(reply);
}

async function sendGenerationRequest(generationType, prompt, characterName = null, callback) {
    const prefix = generationType !== generationMode.BACKGROUND
        ? combinePrefixes(extension_settings.comfy.prompt_prefix, getCharacterPrefix())
        : extension_settings.comfy.prompt_prefix;

    const prefixedPrompt = combinePrefixes(prefix, prompt);

    let result = { format: '', data: '' };
    const currentChatId = getCurrentChatId();

    try {
        switch (extension_settings.comfy.source) {
            case sources.extras:
                result = await generateExtrasImage(prefixedPrompt);
                break;
            case sources.horde:
                result = await generateHordeImage(prefixedPrompt);
                break;
            case sources.auto:
                result = await generateAutoImage(prefixedPrompt);
                break;
            case sources.novel:
                result = await generateNovelImage(prefixedPrompt);
                break;
            case sources.comfy:
                result = await generateComfyImage(prefixedPrompt);
                break;
        }

        if (!result.data) {
            throw new Error();
        }
    } catch (err) {
        toastr.error('Image generation failed. Please try again', 'Stable Diffusion');
        return;
    }

    if (currentChatId !== getCurrentChatId()) {
        console.warn('Chat changed, aborting SD result saving');
        toastr.warning('Chat changed, generated image discarded.', 'Stable Diffusion');
        return;
    }

    const filename = `${characterName}_${humanizedDateTime()}`;
    const base64Image = await saveBase64AsFile(result.data, characterName, filename, result.format);
    callback ? callback(prompt, base64Image) : sendMessage(prompt, base64Image);
}

/**
 * Generates an "extras" image using a provided prompt and other settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateExtrasImage(prompt) {
    const url = new URL(getApiUrl());
    url.pathname = '/api/image';
    const result = await doExtrasFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: prompt,
            sampler: extension_settings.comfy.sampler,
            steps: extension_settings.comfy.steps,
            scale: extension_settings.comfy.scale,
            width: extension_settings.comfy.width,
            height: extension_settings.comfy.height,
            negative_prompt: extension_settings.comfy.negative_prompt,
            restore_faces: !!extension_settings.comfy.restore_faces,
            enable_hr: !!extension_settings.comfy.enable_hr,
            karras: !!extension_settings.comfy.horde_karras,
            hr_upscaler: extension_settings.comfy.hr_upscaler,
            hr_scale: extension_settings.comfy.hr_scale,
            denoising_strength: extension_settings.comfy.denoising_strength,
            hr_second_pass_steps: extension_settings.comfy.hr_second_pass_steps,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: 'jpg', data: data.image };
    } else {
        throw new Error();
    }
}

/**
 * Generates a "horde" image using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateHordeImage(prompt) {
    const result = await fetch('/api/horde/generate-image', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            prompt: prompt,
            sampler: extension_settings.comfy.sampler,
            steps: extension_settings.comfy.steps,
            scale: extension_settings.comfy.scale,
            width: extension_settings.comfy.width,
            height: extension_settings.comfy.height,
            negative_prompt: extension_settings.comfy.negative_prompt,
            model: extension_settings.comfy.model,
            nsfw: extension_settings.comfy.horde_nsfw,
            restore_faces: !!extension_settings.comfy.restore_faces,
            enable_hr: !!extension_settings.comfy.enable_hr,
        }),
    });

    if (result.ok) {
        const data = await result.text();
        return { format: 'webp', data: data };
    } else {
        throw new Error();
    }
}

/**
 * Generates an image in SD WebUI API using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateAutoImage(prompt) {
    const result = await fetch('/api/sd/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            ...getAutoRequestBody(),
            prompt: prompt,
            negative_prompt: extension_settings.comfy.negative_prompt,
            sampler_name: extension_settings.comfy.sampler,
            steps: extension_settings.comfy.steps,
            cfg_scale: extension_settings.comfy.scale,
            width: extension_settings.comfy.width,
            height: extension_settings.comfy.height,
            restore_faces: !!extension_settings.comfy.restore_faces,
            enable_hr: !!extension_settings.comfy.enable_hr,
            hr_upscaler: extension_settings.comfy.hr_upscaler,
            hr_scale: extension_settings.comfy.hr_scale,
            denoising_strength: extension_settings.comfy.denoising_strength,
            hr_second_pass_steps: extension_settings.comfy.hr_second_pass_steps,
            // Ensure generated img is saved to disk
            save_images: true,
            send_images: true,
            do_not_save_grid: false,
            do_not_save_samples: false,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: 'png', data: data.images[0] };
    } else {
        throw new Error();
    }
}

/**
 * Generates an image in NovelAI API using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateNovelImage(prompt) {
    const { steps, width, height } = getNovelParams();

    const result = await fetch('/api/novelai/generate-image', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            prompt: prompt,
            model: extension_settings.comfy.model,
            sampler: extension_settings.comfy.sampler,
            steps: steps,
            scale: extension_settings.comfy.scale,
            width: width,
            height: height,
            negative_prompt: extension_settings.comfy.negative_prompt,
            upscale_ratio: extension_settings.comfy.novel_upscale_ratio,
        }),
    });

    if (result.ok) {
        const data = await result.text();
        return { format: 'png', data: data };
    } else {
        throw new Error();
    }
}

/**
 * Generates an image in ComfyUI API using the provided prompt and configuration settings.
 * 
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @returns {Promise<{format: string, data: string}>}
 */
async function generateComfyImage(prompt) {
    const reps = [
        'negative_prompt',
        'sampler',
        'steps',
        'scale',
        'width',
        'height',
        'restore_faces',
        'enable_hr',
        'hr_upscaler',
        'hr_scale',
        'denoising_strength',
        'hr_second_pass_steps',
    ];
    let workflow = extension_settings.comfy.comfy_workflow.replace('"%prompt%"', JSON.stringify(prompt));
    reps.forEach(rep=>{
        workflow = workflow.replace(`"%${rep}%"`, JSON.stringify(extension_settings.comfy[rep]));
    });
    console.log(`{
        "prompt": ${workflow}
    }`);
    const promptResult = await fetch(`${extension_settings.comfy.comfy_url}/prompt`, {
        method: 'POST',
        body: `{
            "prompt": ${workflow}
        }`,
    });
    if (promptResult.ok) {
        const id = (await promptResult.json()).prompt_id;
        let item;
        while (true) {
            const result = await fetch(`${extension_settings.comfy.comfy_url}/history`);
            if (result.ok) {
                const history = await result.json();
                item = history[id];
                if (item) {
                    break;
                }
                await new Promise(resolve=>window.setTimeout(resolve, 100));
            } else {
                throw new Error();
            }
        }
        const imgInfo = Object.keys(item.outputs).map(it=>item.outputs[it].images).flat()[0];
        let img;
        await new Promise(resolve=>{
            img = new Image();
            img.crossOrigin = 'anonymous';
            img.addEventListener('load', resolve);
            img.addEventListener('error', (...v)=>{
                console.warn(v);
                resolve();
            });
            img.src = `${extension_settings.comfy.comfy_url}/view?filename=${imgInfo.filename}&subfolder=${imgInfo.subfolder}&type=${imgInfo.type}`;
            console.log('[ComfyUI]', img.src);
        });
        const canvas = new OffscreenCanvas(extension_settings.comfy.width, extension_settings.comfy.height);
        const con = canvas.getContext('2d');
        con.drawImage(img, 0,0);
        const imgBlob = await canvas.convertToBlob();
        const dataUrl = await new Promise(resolve=>{
            const reader = new FileReader();
            reader.addEventListener('load', ()=>resolve(reader.result));
            reader.readAsDataURL(imgBlob);
        });
        console.log('[ComfyUI]', dataUrl);
        return {format: 'png', data: dataUrl.split(',').pop()};
    } else {
        throw new Error();
    }
}

/**
 * Adjusts extension parameters for NovelAI. Applies Anlas guard if needed.
 * @returns {{steps: number, width: number, height: number}} - A tuple of parameters for NovelAI API.
 */
function getNovelParams() {
    let steps = extension_settings.comfy.steps;
    let width = extension_settings.comfy.width;
    let height = extension_settings.comfy.height;

    // Don't apply Anlas guard if it's disabled.d
    if (!extension_settings.comfy.novel_anlas_guard) {
        return { steps, width, height };
    }

    const MAX_STEPS = 28;
    const MAX_PIXELS = 409600;

    if (width * height > MAX_PIXELS) {
        const ratio = Math.sqrt(MAX_PIXELS / (width * height));

        // Calculate new width and height while maintaining aspect ratio.
        var newWidth = Math.round(width * ratio);
        var newHeight = Math.round(height * ratio);

        // Ensure new dimensions are multiples of 64. If not, reduce accordingly.
        if (newWidth % 64 !== 0) {
            newWidth = newWidth - newWidth % 64;
        }

        if (newHeight % 64 !== 0) {
            newHeight = newHeight - newHeight % 64;
        }

        // If total pixel count after rounding still exceeds MAX_PIXELS, decrease dimension size by 64 accordingly.
        while (newWidth * newHeight > MAX_PIXELS) {
            if (newWidth > newHeight) {
                newWidth -= 64;
            } else {
                newHeight -= 64;
            }
        }

        console.log(`Anlas Guard: Image size (${width}x${height}) > ${MAX_PIXELS}, reducing size to ${newWidth}x${newHeight}`);
        width = newWidth;
        height = newHeight;
    }

    if (steps > MAX_STEPS) {
        console.log(`Anlas Guard: Steps (${steps}) > ${MAX_STEPS}, reducing steps to ${MAX_STEPS}`);
        steps = MAX_STEPS;
    }

    return { steps, width, height };
}

async function sendMessage(prompt, image) {
    const context = getContext();
    const messageText = `[${context.name2} sends a picture that contains: ${prompt}]`;
    const message = {
        name: context.groupId ? systemUserName : context.name2,
        is_user: false,
        is_system: true,
        send_date: getMessageTimeStamp(),
        mes: context.groupId ? p(messageText) : messageText,
        extra: {
            image: image,
            title: prompt,
        },
    };
    context.chat.push(message);
    context.addOneMessage(message);
    context.saveChat();
}

function addSDGenButtons() {

    const buttonHtml = `
    <div id="comfy_gen" class="list-group-item flex-container flexGap5">
        <div class="fa-solid fa-paintbrush extensionsMenuExtensionButton" title="Trigger ComfyUI" /></div>
        ComfyUI
    </div>
        `;

    const waitButtonHtml = `
        <div id="comfy_gen_wait" class="fa-solid fa-hourglass-half" /></div>
    `
    const dropdownHtml = `
    <div id="comfy_dropdown">
        <ul class="list-group">
        <span>Send me a picture of:</span>
            <li class="list-group-item" id="comfy_you" data-value="you">Yourself</li>
            <li class="list-group-item" id="comfy_face" data-value="face">Your Face</li>
            <li class="list-group-item" id="comfy_me" data-value="me">Me</li>
            <li class="list-group-item" id="comfy_world" data-value="world">The Whole Story</li>
            <li class="list-group-item" id="comfy_last" data-value="last">The Last Message</li>
            <li class="list-group-item" id="comfy_raw_last" data-value="raw_last">Raw Last Message</li>
            <li class="list-group-item" id="comfy_background" data-value="background">Background</li>
        </ul>
    </div>`;

    $('#extensionsMenu').prepend(buttonHtml);
    $('#extensionsMenu').prepend(waitButtonHtml);
    $(document.body).append(dropdownHtml);

    const messageButton = $('.comfy_message_gen');
    const button = $('#comfy_gen');
    const waitButton = $("#comfy_gen_wait");
    const dropdown = $('#comfy_dropdown');
    waitButton.hide();
    dropdown.hide();
    button.hide();
    messageButton.hide();

    let popper = Popper.createPopper(button.get(0), dropdown.get(0), {
        placement: 'top',
    });

    $(document).on('click', '.comfy_message_gen', sdMessageButton);

    $(document).on('click touchend', function (e) {
        const target = $(e.target);
        if (target.is(dropdown)) return;
        if (target.is(button) && !dropdown.is(":visible") && $("#send_but").is(":visible")) {
            e.preventDefault();

            dropdown.fadeIn(250);
            popper.update();
        } else {
            dropdown.fadeOut(250);
        }
    });
}

function isValidState() {
    switch (extension_settings.comfy.source) {
        case sources.extras:
            return modules.includes('sd');
        case sources.horde:
            return true;
        case sources.auto:
            return !!extension_settings.comfy.auto_url;
        case sources.novel:
            return secret_state[SECRET_KEYS.NOVEL];
        case sources.comfy:
            return true;
    }
}

async function moduleWorker() {
    if (isValidState()) {
        $('#comfy_gen').show();
        $('.sd_message_gen').show();
    }
    else {
        $('#comfy_gen').hide();
        $('.sd_message_gen').hide();
    }
}

addSDGenButtons();
setInterval(moduleWorker, UPDATE_INTERVAL);

async function sdMessageButton(e) {
    function setBusyIcon(isBusy) {
        $icon.toggleClass('fa-paintbrush', !isBusy);
        $icon.toggleClass(busyClass, isBusy);
    }

    const busyClass = 'fa-hourglass';
    const context = getContext();
    const $icon = $(e.currentTarget);
    const $mes = $icon.closest('.mes');
    const message_id = $mes.attr('mesid');
    const message = context.chat[message_id];
    const characterName = message?.name || context.name2;
    const characterFileName = context.characterId ? context.characters[context.characterId].name : context.groups[Object.keys(context.groups).filter(x => context.groups[x].id === context.groupId)[0]].id.toString();
    const messageText = message?.mes;
    const hasSavedImage = message?.extra?.image && message?.extra?.title;

    if ($icon.hasClass(busyClass)) {
        console.log('Previous image is still being generated...');
        return;
    }

    try {
        setBusyIcon(true);
        if (hasSavedImage) {
            const prompt = await refinePrompt(message.extra.title);
            message.extra.title = prompt;

            console.log('Regenerating an image, using existing prompt:', prompt);
            await sendGenerationRequest(generationMode.FREE, prompt, characterFileName, saveGeneratedImage);
        }
        else {
            console.log("doing /sd raw last");
            await generatePicture('sd', 'raw_last', `${characterName} said: ${messageText}`, saveGeneratedImage);
        }
    }
    catch (error) {
        console.error('Could not generate inline image: ', error);
    }
    finally {
        setBusyIcon(false);
    }

    function saveGeneratedImage(prompt, image) {
        // Some message sources may not create the extra object
        if (typeof message.extra !== 'object') {
            message.extra = {};
        }

        // If already contains an image and it's not inline - leave it as is
        message.extra.inline_image = message.extra.image && !message.extra.inline_image ? false : true;
        message.extra.image = image;
        message.extra.title = prompt;
        appendImageToMessage(message, $mes);

        context.saveChat();
    }
};

$("#comfy_dropdown [id]").on("click", function () {
    const id = $(this).attr("id");
    const idParamMap = {
        "comfy_you": "you",
        "comfy_face": "face",
        "comfy_me": "me",
        "comfy_world": "scene",
        "comfy_last": "last",
        "comfy_raw_last": "raw_last",
        "comfy_background": "background"
    };

    const param = idParamMap[id];

    if (param) {
        console.log("doing /comfy " + param)
        generatePicture('comfy', param);
    }
});

jQuery(async () => {
    getContext().registerSlashCommand('comfy', generatePicture, [], helpString, true, true);

    $('#extensions_settings').append(renderExtensionTemplate('third-party/sillytavern-comfyui', 'settings', defaultSettings));
    $('#comfy_source').on('change', onSourceChange);
    $('#comfy_scale').on('input', onScaleInput);
    $('#comfy_steps').on('input', onStepsInput);
    $('#comfy_model').on('change', onModelChange);
    $('#comfy_sampler').on('change', onSamplerChange);
    $('#comfy_prompt_prefix').on('input', onPromptPrefixInput);
    $('#comfy_negative_prompt').on('input', onNegativePromptInput);
    $('#comfy_width').on('input', onWidthInput);
    $('#comfy_height').on('input', onHeightInput);
    $('#comfy_horde_nsfw').on('input', onHordeNsfwInput);
    $('#comfy_horde_karras').on('input', onHordeKarrasInput);
    $('#comfy_restore_faces').on('input', onRestoreFacesInput);
    $('#comfy_enable_hr').on('input', onHighResFixInput);
    $('#comfy_refine_mode').on('input', onRefineModeInput);
    $('#comfy_character_prompt').on('input', onCharacterPromptInput);
    $('#comfy_auto_validate').on('click', validateAutoUrl);
    $('#comfy_auto_url').on('input', onAutoUrlInput);
    $('#comfy_auto_auth').on('input', onAutoAuthInput);
    $('#comfy_hr_upscaler').on('change', onHrUpscalerChange);
    $('#comfy_hr_scale').on('input', onHrScaleInput);
    $('#comfy_denoising_strength').on('input', onDenoisingStrengthInput);
    $('#comfy_hr_second_pass_steps').on('input', onHrSecondPassStepsInput);
    $('#comfy_novel_upscale_ratio').on('input', onNovelUpscaleRatioInput);
    $('#comfy_novel_anlas_guard').on('input', onNovelAnlasGuardInput);
    $('#comfy_novel_view_anlas').on('click', onViewAnlasClick);
    $('#comfy_comfy_url').on('input', onComfyUrlInput);
    $('#comfy_comfy_workflow').on('input', onComfyWorkflowInput);
    $('#comfy_character_prompt_block').hide();

    $('.sd_settings .inline-drawer-toggle').on('click', function () {
        initScrollHeight($("#comfy_prompt_prefix"));
        initScrollHeight($("#comfy_negative_prompt"));
        initScrollHeight($("#comfy_character_prompt"));
    })

    eventSource.on(event_types.EXTRAS_CONNECTED, async () => {
        await Promise.all([loadSamplers(), loadModels()]);
    });

    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

    await loadSettings();
    $('body').addClass('sd');
});
