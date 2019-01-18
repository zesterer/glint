#version 140

uniform vec3  cam_pos;
uniform mat4  proj_mat;
uniform mat4  view_mat;
uniform float time;

in vec2 f_pos;

out vec4 f_color;

#define MAX_ITERS 100
#define PLANK 0.015
#define MAX_REFLECTIONS 1

float length_squared(vec3 v) {
	return v.x * v.x + v.y * v.y + v.z * v.z;
}

float sphere(vec3 pos) {
	return length_squared(mod(pos, 1.0) - 0.5) - 0.05;
}

float vmax(vec3 v) {
	return max(max(v.x, v.y), v.z);
}

float vmin(vec3 v) {
	return min(min(v.x, v.y), v.z);
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

float march_shadow(vec3 pos, vec3 dir) {
	float min_dist = 100000.0;
	float last_dist = 100000.0;
	vec3 start_pos = pos;
	for (int i = 0; i < MAX_ITERS; i ++) {
		float dist = sdf(pos);

		float prec = length_squared((cam_pos - pos) * 0.1) / 20.0;

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

	//float diffuse = max(dot(light_dir, norm), 0.0) - 0.1;
	float specular = pow(max(dot(reflect(dir, norm), light_dir), 0.0), 20.0);

	float shadow = march_shadow(pos + light_dir * PLANK * 10.0, light_dir);

	vec3 color = vec3(sin(pos.x * 4.0), sin(pos.y * 4.0), sin(pos.z * 4.0)) * 0.5 + 0.5;

	if (is_light(pos)) {
		return vec3(4.0);
	}

	return color * shadow + specular * shadow;
}

void main() {
	f_color = vec4(0.0, 0.0, 0.0, 1.0);

	vec3 pos = (view_mat * vec4(0.0, 0.0, 0.0, 1.0)).xyz + cam_pos;
	vec3 dir = normalize((view_mat * proj_mat * vec4(f_pos, 1.0, 1.0)).xyz);
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
