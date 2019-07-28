let canvas = document.createElement("canvas");
let context = canvas.getContext("2d");
function smooth_gaussian(width, height, original, smoothed, sigma) {
    let r = Math.ceil(sigma * 3);
    let r2 = 2 * r + 1;
    // precompute spatial stencil
    let stencil = new Float32Array(r2 * r2);
    for (let dy = -r; dy <= r; ++dy)
    for (let dx = -r; dx <= r; ++dx)
    {
        let h = Math.sqrt(dx * dx + dy * dy);
        let idx = dx + r + r2 * (dy + r);
        stencil[idx] = Math.exp(-h * h / (2 * sigma * sigma));
    }
    // apply filter
    for (let py = 0; py < height; py++)
    for (let px = 0; px < width;  px++)
    {
        let idx0 = px + width * py;
        let r_sum = 0;
        let g_sum = 0;
        let b_sum = 0;
        let w_sum = 0;
        for (let dy = -r; dy <= r; ++dy)
        for (let dx = -r; dx <= r; ++dx)
        {
            let px1 = px + dx;
            let py1 = py + dy;
            if (0 <= px1 && 0 <= py1 && px1 < width && py1 < height) {
                let w = stencil[dx + r + r2 * (dy + r)];
                let idx1 = px1 + width * py1;
                let r1 = original[4 * idx1];
                let g1 = original[4 * idx1 + 1];
                let b1 = original[4 * idx1 + 2];
                r_sum += w * r1;
                g_sum += w * g1;
                b_sum += w * b1;
                w_sum += w;
            }
        }
        smoothed[4 * idx0    ] = r_sum / w_sum;
        smoothed[4 * idx0 + 1] = g_sum / w_sum;
        smoothed[4 * idx0 + 2] = b_sum / w_sum;
        smoothed[4 * idx0 + 3] = 255;
    }
};
function smooth_bilateral(width, height, original, smoothed, sigma_space, sigma_range) {
    let r = Math.ceil(sigma_space * 3);
    let r2 = 2 * r + 1;
    // precompute spatial stencil
    let stencil = new Float32Array(r2 * r2);
    for (let dy = -r; dy <= r; ++dy)
    for (let dx = -r; dx <= r; ++dx)
    {
        let h = Math.sqrt(dx * dx + dy * dy);
        let idx = dx + r + r2 * (dy + r);
        stencil[idx] = Math.exp(-h * h / (2 * sigma_space * sigma_space));
    }
    // apply filter
    for (let py = 0; py < height; py++)
    for (let px = 0; px < width;  px++)
    {
        let idx0 = px + width * py;
        let r_sum = 0;
        let g_sum = 0;
        let b_sum = 0;
        let w_sum = 0;
        for (let dy = -r; dy <= r; ++dy)
        for (let dx = -r; dx <= r; ++dx)
        {
            let px1 = px + dx;
            let py1 = py + dy;
            if (0 <= px1 && 0 <= py1 && px1 < width && py1 < height) {
                let w_space = stencil[dx + r + r2 * (dy + r)];
                let idx1 = px1 + width * py1;
                let r1 = original[4 * idx1];
                let g1 = original[4 * idx1 + 1];
                let b1 = original[4 * idx1 + 2];

                let sum = 0;
                for (let i = 0; i < 3; i++) {
                  let diff = Math.abs(original[4*idx0 + i] - original[4*idx1 + i]);
                  sum += diff*diff;
                }
                sum = Math.sqrt(sum);
                let w_range = (1/(Math.sqrt(2*Math.PI)*sigma_range))*Math.exp(-(sum*sum)/(2*sigma_range*sigma_range));

                let w = w_space * w_range;
                r_sum += w * r1;
                g_sum += w * g1;
                b_sum += w * b1;
                w_sum += w;
            }
        }
        smoothed[4 * idx0    ] = r_sum / w_sum;
        smoothed[4 * idx0 + 1] = g_sum / w_sum;
        smoothed[4 * idx0 + 2] = b_sum / w_sum;
        smoothed[4 * idx0 + 3] = 255;
    }
};
function subtract(width, height, original, smoothed, detail) {
    for (let i = 0; i < width * height; ++i) {
        for (let j = 0; j < 3; ++j) {
            let ij = 4 * i + j;
            detail[ij] = 128 + original[ij] - smoothed[ij];
        }
        detail[4 * i + 3] = 255;
    }
};
function enhance_detail(width, height, smoothed, detail, scaling, enhanced) {
    for (let i = 0; i < width * height; ++i) {
        for (let j = 0; j < 3; ++j) {
            let ij = 4 * i + j;
            enhanced[ij] = Math.min(255, Math.max(0, smoothed[ij] + scaling * (detail[ij] - 128)));
        }
        enhanced[4 * i + 3] = 255;
    }
};
function init() {
    document.getElementById("img_original").onload = function(){
        canvas.width  = this.width;
        canvas.height = this.height;
        document.getElementById("img_smoothed").width  = this.width;
        document.getElementById("img_smoothed").height = this.height;
        document.getElementById("img_detail"  ).width  = this.width;
        document.getElementById("img_detail"  ).height = this.height;
        document.getElementById("img_enhanced").width  = this.width;
        document.getElementById("img_enhanced").height = this.height;
    };
    document.getElementById("input_file_original").onchange = function(evt) {
        let reader = new FileReader();
        reader.readAsDataURL(evt.target.files[0]);
        reader.onload = function(){
            document.getElementById("img_original").src = this.result;
        };
    };
    document.getElementById("btn_do_smoothing").onclick = function() {
        let width = canvas.width;
        let height = canvas.height;
        // read original
        context.drawImage(document.getElementById("img_original"), 0, 0);
        let original = context.getImageData(0, 0, width, height);
        // do smoothing
        let smoothed = context.createImageData(width, height);
        let sigma_space = Number(document.getElementById("input_num_sigma_space").value);
        let sigma_range = Number(document.getElementById("input_num_sigma_range").value);
        if (document.getElementById("input_chk_use_bilateral").checked)
            smooth_bilateral(width, height, original.data, smoothed.data, sigma_space, sigma_range);
        else
            smooth_gaussian(width, height, original.data, smoothed.data, sigma_space);
        context.putImageData(smoothed, 0, 0);
        document.getElementById("img_smoothed").src = canvas.toDataURL();
        // detail = original - smoothed
        let detail = context.createImageData(width, height);
        subtract(width, height, original.data, smoothed.data, detail.data);
        context.putImageData(detail, 0, 0);
        document.getElementById("img_detail").src = canvas.toDataURL();
    };
    document.getElementById("btn_enhance_detail").onclick = function() {
        let width = canvas.width;
        let height = canvas.height;
        // read smoothed and detail
        context.drawImage(document.getElementById("img_smoothed"), 0, 0);
        let smoothed = context.getImageData(0, 0, width, height);
        context.drawImage(document.getElementById("img_detail"), 0, 0);
        let detail = context.getImageData(0, 0, width, height);
        // enhanced = smoothed + scale * detail
        let enhanced = context.createImageData(width, height);
        let detail_scaling = Number(document.getElementById("input_num_detail_scaling").value);
        enhance_detail(width, height, smoothed.data, detail.data, detail_scaling, enhanced.data);
        context.putImageData(enhanced, 0, 0);
        document.getElementById("img_enhanced").src = canvas.toDataURL();
    };
    document.getElementById("img_original").src = "https://cdn.glitch.com/1214143e-0c44-41fb-b1ad-e9aa3347cdaa%2Frock.png?v=1562148154890";
};
