#version 140

uniform vec3  cam_pos;
uniform mat4  proj_mat;
uniform mat4  view_mat;
uniform float time;

in vec2 f_pos;

out vec4 f_color;

#define MAX_ITERS 300
#define PLANK 0.01
#define MAX_REFLECTIONS 0

float length_squared(vec3 v) {
	return v.x * v.x + v.y * v.y + v.z * v.z;
}

float vmax(vec3 v) {
	return max(max(v.x, v.y), v.z);
}

float vmin(vec3 v) {
	return min(min(v.x, v.y), v.z);
}

float sphere(vec3 pos) {
	vec3 looped = mod(pos, 1.0);
	return length_squared(looped - 0.5) - 0.05 + sin(sin(pos.x * 20.0) + sin(pos.y * 20.0) + sin(pos.z * 20.0)) * 0.02;
}

float rand(vec3 pos, float seed) {
    vec4 K1 = vec4(
        23.14069263277926,  // e^pi (Gelfond's constant)
         2.665144142690225, // 2^sqrt(2) (Gelfondâ€“Schneider constant)
		 3.14159265,        // pi
		 1.337133713371337  // Leet
    );
    return fract(cos(dot(vec4(pos, seed), K1)) * 12345.6789);
}

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x*34.0)+1.0)*x);
}

float snoise(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
// First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

// Other corners
  vec2 i1;
  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
  //i1.y = 1.0 - i1.x;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  // x0 = x0 - 0.0 + 0.0 * C.xx ;
  // x1 = x0 - i1 + 1.0 * C.xx ;
  // x2 = x0 - 1.0 + 2.0 * C.xx ;
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

// Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
		+ i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

// Gradients: 41 points uniformly over a line, mapped onto a diamond.
// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

// Normalise gradients implicitly by scaling m
// Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

// Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

int voxel_at(vec3 pos, float scale) {
	pos.z *= -1.0;
	float dist = //length(pos) - 100.0;
		//snoise(pos.xy / 120.0) * 30.0 +
		//snoise(pos.xy / 40.0) * 8.0;
		pos.z - sin(pos.x / 20.0) * 20.0 + sin(pos.y / 20.0) * 20.0;
		//sin(pos.x / 3.5) * 3.0 + sin(pos.y / 3.5) * 3.0;
	if (dist > +scale * 2.5) {
		return 1;
	} else if (dist < -scale * 2.5) {
		return -1;
	} else {
		return 0;
	}
}

vec3 voxel_color_at(vec3 pos) {
	return (vec3(
		sin(pos.x / 3.0),
		sin(pos.y / 3.0),
		sin(pos.z / 3.0)
	) + 1.0) / 2.0 * (0.7 + rand(pos, 1.0) * 0.3);
}

vec3 march_voxels(vec3 pos, vec3 dir) {
	float dist = 0.0;
	float min_scale_dist = 0;
	float scale = 16.0;
	float min_scale = scale;
	for (int i = 0; i < 1000; i ++) {
		vec3 cpos = pos + dir * dist;
		vec3 vox_pos = floor(cpos - fract(cpos / scale) * scale);

		if (scale < min_scale) {
			min_scale_dist = dist;
			min_scale = scale;
		}

		if (scale > 1024.0) {
			return vec3(0.3, 0.5, 1.0);
		} else if (scale < 1.0) {
			break;
		}

		int voxel = voxel_at(vox_pos, scale);
		if (voxel == 1) {
			vec3 deltas = (step(0, dir) - fract(cpos / scale)) / dir;
			dist += max(vmin(deltas), PLANK * scale) * scale;
			scale *= 2.0;
		} else if (voxel == -1) {
			return voxel_color_at(vox_pos);
		} else {
			scale *= 0.5;
		}
	}
	vec3 cpos = pos + dir * min_scale_dist;
	vec3 vox_pos = floor(cpos - fract(cpos / min_scale) * min_scale);
	return mix(voxel_color_at(vox_pos), vec3(0.3, 0.5, 1.0), pow(min(dist / 4096.0, 1.0), 2.0));
}

vec3 phong(vec3 color, vec3 norm, vec3 dir) {
	vec3 light_dir = normalize(vec3(1.0, 1.0, -1.0));

	float diffuse = max(dot(light_dir, norm), 0.0);
	float specular = pow(max(dot(reflect(dir, norm), light_dir), 0.0), 20.0);

	return color * (0.2 + diffuse + specular);
}

float ssdf(vec3 pos) {
	return length(pos) - 1000.0
		+ sin(pos.x / 30.0) * 20.0
		+ sin(pos.y / 30.0) * 20.0
		+ sin(pos.z / 30.0) * 20.0
		+ sin(pos.x / 5.0) * 5.0
		+ sin(pos.y / 5.0) * 5.0
		+ sin(pos.z / 5.0) * 5.0
		+ sin(pos.x / 1.3) * 1.3
		+ sin(pos.y / 1.3) * 1.3
		+ sin(pos.z / 1.3) * 1.3
		+ sin(pos.x / 0.2) * 0.3
		+ sin(pos.y / 0.2) * 0.2
		+ sin(pos.z / 0.2) * 0.2
		+ sin(pos.x / 0.05) * 0.1
		+ sin(pos.y / 0.05) * 0.1
		+ sin(pos.z / 0.05) * 0.1
	;
}

vec3 ssdf_norm(vec3 pos) {
	return normalize(vec3(
		ssdf(pos + vec3(PLANK, 0.0, 0.0)) - ssdf(pos - vec3(PLANK, 0.0, 0.0)),
		ssdf(pos + vec3(0.0, PLANK, 0.0)) - ssdf(pos - vec3(0.0, PLANK, 0.0)),
		ssdf(pos + vec3(0.0, 0.0, PLANK)) - ssdf(pos - vec3(0.0, 0.0, PLANK))
	));
}

vec3 planet_color(vec3 pos) {
	return vec3(
		0.2 + (sin(pos.x * 10.0) + sin(pos.y * 10.0) + sin(pos.z * 10.0) + 3.0) / 8.0,
		0.2 + (sin(pos.x *  1.0) + sin(pos.y *  1.0) + sin(pos.z *  1.0) + 3.0) / 8.0,
		0.2 + (sin(pos.x *  0.1) + sin(pos.y *  0.1) + sin(pos.z *  0.1) + 3.0) / 8.0
	);
}

vec3 march_ssdf(vec3 pos, vec3 dir) {
	float t = 0.0;
	float min_d = 100000.0;
	float min_t;
	for (int i = 0; i < 128; i ++) {
		float prec = t / 5.0;

		vec3 p = pos + dir * t;

		float d = (ssdf(p) + PLANK * prec) * 0.25;

		if (d < min_d) {
			min_d = d;
			min_t = t;
		}

		if (d < PLANK * prec) {
			return phong(planet_color(p), ssdf_norm(p), dir);
		} else if (t > 100000.0) {
			return vec3(0);
		} else {
			t += d;
		}
	}
	if (abs(min_t - t) > 400.0) {
		return vec3(0);
	} else {
		vec3 p = pos + dir * min_t;
		return phong(planet_color(p), ssdf_norm(p), dir);
	}
}

float sdf(vec3 pos) {
	return sphere(pos);
	vec3 mini_pos = mod(pos, 2.0);
	if (
		true ||
		mini_pos.x < 1.0 &&
		mini_pos.y < 1.0 &&
		mini_pos.z < 1.0
	) {
		return //min(
			//vmax(abs(mod(pos, 1.0) - 0.5)) - 0.15,
			sphere(pos);
		//);
	} else {
		return min(sphere(pos), 0.25);
		//return vmax(abs(mod(pos, 1.0) - 0.5)) - 0.25;
	}
}

vec3 sdf_norm(vec3 pos) {
	return normalize(vec3(
		sdf(pos + vec3(PLANK, 0.0, 0.0)) - sdf(pos - vec3(PLANK, 0.0, 0.0)),
		sdf(pos + vec3(0.0, PLANK, 0.0)) - sdf(pos - vec3(0.0, PLANK, 0.0)),
		sdf(pos + vec3(0.0, 0.0, PLANK)) - sdf(pos - vec3(0.0, 0.0, PLANK))
	));
}

bool is_light(vec3 pos) {
	vec3 mini_pos = mod(pos, 15.0);
	return
		mini_pos.x > 7.0 && mini_pos.x < 8.0 &&
		mini_pos.y > 7.0 && mini_pos.y < 8.0 &&
		mini_pos.z > 7.0 && mini_pos.z < 8.0;
}

vec3 dir_to_nearest_light(vec3 pos) {
	return -normalize(mod(pos, 15.0) - 7.5);
}

float dist_to_nearest_light(vec3 pos) {
	return length_squared(mod(pos, 15.0) - 7.5);
}

float march_shadow(vec3 pos, vec3 dir) {
	float min_dist = 100000.0;
	float last_dist = 100000.0;
	vec3 start_pos = pos;
	for (int i = 0; i < MAX_ITERS / 3; i ++) {
		float dist = sdf(pos);

		float prec = length_squared((start_pos - pos) * 1.5) / 20.0;

		if (dist < PLANK * prec) {
			if (is_light(pos)) {
				return min(1.0 * min_dist, 1.0);
			} else {
				break;
			}
		}

		if (dist > last_dist) {
			min_dist = min(min_dist, last_dist);
		}

		pos += dir * dist;
		last_dist = dist;
	}
	return 0.0;
}

vec3 compute_color(vec3 pos, vec3 dir) {
	vec3 norm = sdf_norm(pos);

	vec3 light_dir = dir_to_nearest_light(pos);
	//vec3 light_dir = normalize(vec3(1.0, 1.0, -1.0));

	float diffuse = max(dot(light_dir, norm), 0.0) - 0.1;
	float specular = pow(max(dot(reflect(dir, norm), light_dir), 0.0), 20.0);

	float shadow = 1.0;//march_shadow(pos + light_dir * PLANK * 10.0, light_dir);

	vec3 color = vec3(sin(pos.x * 4.0), sin(pos.y * 4.0), sin(pos.z * 4.0)) * 0.5 + 0.5;

	if (is_light(pos)) {
		return vec3(4.0);
	}

	float light_dist = dist_to_nearest_light(pos);
	return color * shadow * diffuse / light_dist + specular * shadow / light_dist;
}

void main() {
	f_color = vec4(0.0, 0.0, 0.0, 1.0);

	vec3 pos = (view_mat * vec4(0.0, 0.0, 0.0, 1.0)).xyz + cam_pos;
	vec3 dir = normalize((view_mat * proj_mat * vec4(f_pos, 1.0, 1.0)).xyz);

	f_color = vec4(march_ssdf(pos, dir), 1.0);
	return;

	float color_weight = 0.9;
	vec3 total_color = vec3(0);
	int reflections = 0;
	bool in_obj = false;
	for (int i = 0; i < MAX_ITERS; i ++) {
		float prec = length_squared((cam_pos - pos) * 1.3) / 20.0;

		float dist = sdf(pos) + PLANK * prec;

		if (dist < PLANK * prec) {
			total_color += color_weight * compute_color(pos, dir);
			color_weight /= 9.0;

			dir = reflect(dir, sdf_norm(pos));
			pos += dir * PLANK * prec;

			if (reflections == MAX_REFLECTIONS) {
				break;
			} else {
				reflections += 1;
			}
		}

		pos += dir * dist;
	}
	f_color = vec4(total_color, 1.0);
}
