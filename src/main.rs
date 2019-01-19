#[macro_use]
extern crate glium;

use glium::{glutin, Surface};
use glium::index::PrimitiveType;
use vek::*;

fn arr_to_mat(arr: [f32; 16]) -> [[f32; 4]; 4] {
    [
        [arr[ 0], arr[ 1], arr[ 2], arr[ 3]],
        [arr[ 4], arr[ 5], arr[ 6], arr[ 7]],
        [arr[ 8], arr[ 9], arr[10], arr[11]],
        [arr[12], arr[13], arr[14], arr[15]],
    ]
}

fn main() {
    let mut events_loop = glutin::EventsLoop::new();
    let wb = glutin::WindowBuilder::new();
    let context = glutin::ContextBuilder::new();
    let display = glium::Display::new(wb.clone(), context, &events_loop).unwrap();

    // building the vertex buffer, which contains all the vertices that we will draw
    let vertex_buffer = {
        #[derive(Copy, Clone)]
        struct Vertex {
            pos: [f32; 2],
        }

        implement_vertex!(Vertex, pos);

        glium::VertexBuffer::new(&display,
            &[
                Vertex { pos: [-1.0, -1.0] },
                Vertex { pos: [ 1.0, -1.0] },
                Vertex { pos: [ 1.0,  1.0] },
                Vertex { pos: [ 1.0,  1.0] },
                Vertex { pos: [-1.0,  1.0] },
                Vertex { pos: [-1.0, -1.0] },
            ]
        ).unwrap()
    };

    // building the index buffer
    let index_buffer = glium::IndexBuffer::new(
        &display,
        PrimitiveType::TrianglesList,
        &[0u16, 1, 2, 3, 4, 5],
    ).unwrap();

    // compiling shaders and linking them together
    let program = program!(&display,
        140 => {
            vertex: include_str!("vert.vert"),
            fragment: include_str!("frag.frag"),
        },
    ).unwrap();

    let mut cam_ori = Vec3::zero();
    let mut pos = Vec3::<f32>::new(0.0, 0.0, -1020.0);

    let mut fwd = false;
    let mut back = false;
    let mut left = false;
    let mut right = false;
    let mut up = false;
    let mut down = false;
    let mut grab = false;

    // the main loop
    let mut time = 0.0f32;
    let mut running = true;
    while running {
        events_loop.poll_events(|event| match event {
            glutin::Event::WindowEvent { event, .. } => match event {
                // Break from the main loop when the window is closed.
                glutin::WindowEvent::CloseRequested => running = false,
                glutin::WindowEvent::KeyboardInput { input, .. } => {
                    let pressed = input.state == glutin::ElementState::Pressed;
                    match input.virtual_keycode {
                        Some(glutin::VirtualKeyCode::W) => { fwd = pressed; },
                        Some(glutin::VirtualKeyCode::S) => { back = pressed; },
                        Some(glutin::VirtualKeyCode::A) => { left = pressed; },
                        Some(glutin::VirtualKeyCode::D) => { right = pressed; },
                        Some(glutin::VirtualKeyCode::Space) => { up = pressed; },
                        Some(glutin::VirtualKeyCode::LShift) => { down = pressed; },
                        Some(glutin::VirtualKeyCode::Escape) => if pressed {
                            grab = !grab;
                            display.gl_window().grab_cursor(grab);
                            display.gl_window().hide_cursor(grab);
                        },
                        _ => {},
                    }
                },
                _ => (),
            },
            glutin::Event::DeviceEvent { event, .. } => match event {
                glutin::DeviceEvent::MouseMotion { delta } => {
                    cam_ori.x += delta.0 as f32 * 0.002;
                    cam_ori.y = (cam_ori.y as f32 + delta.1 as f32 * 0.002)
                        .max(-std::f32::consts::PI / 2.0)
                        .min(std::f32::consts::PI / 2.0);
                },
                _ => {},
            },
            _ => (),
        });

        let proj_mat = Mat4::perspective_rh_no(
            0.9,
            1366.0 / 768.0,
            0.00001,
            1.0,
        );
        let view_mat = Mat4::<f32>::identity()
            * Mat4::rotation_z(cam_ori.x)
            * Mat4::rotation_x(-cam_ori.y)
            * Mat4::rotation_3d(std::f32::consts::PI / 2.0, -Vec4::unit_x());

        pos += view_mat * Vec4::new(
            if right { 1.0 } else { 0.0 } - if left { 1.0 } else { 0.0 },
            if up { 1.0 } else { 0.0 } - if down { 1.0 } else { 0.0 },
            if back { 1.0 } else { 0.0 } - if fwd { 1.0 } else { 0.0 },
            0.0,
        ) * 0.5;

        // building the uniforms
        let uniforms = uniform! {
            cam_pos: pos.into_array(),
            proj_mat: arr_to_mat(proj_mat.inverted().into_col_array()),
            view_mat: arr_to_mat(view_mat.into_col_array()),
            time: time,
        };

        // drawing a frame
        let mut target = display.draw();
        target.clear_color(0.0, 0.0, 0.0, 0.0);
        target.draw(
            &vertex_buffer,
            &index_buffer,
            &program,
            &uniforms,
            &Default::default(),
        ).unwrap();
        target.finish().unwrap();

        time += 1.0 / 60.0;
    }
}

