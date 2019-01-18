#version 140

uniform vec3  cam_pos;
uniform mat4  proj_mat;
uniform mat4  view_mat;
uniform float time;

in vec2 pos;

out vec2 f_pos;

void main() {
	gl_Position = vec4(pos, 0.0, 1.0);
	f_pos = pos;
}
