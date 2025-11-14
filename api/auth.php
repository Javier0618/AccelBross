<?php
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

session_start();

switch($method) {
    case 'POST':
        if (isset($input['action'])) {
            if ($input['action'] === 'login') {
                // Login
                $email = $input['email'] ?? '';
                $password = $input['password'] ?? '';
                
                $query = "SELECT * FROM users WHERE email = :email LIMIT 1";
                $stmt = $db->prepare($query);
                $stmt->bindParam(':email', $email);
                $stmt->execute();
                
                if ($stmt->rowCount() > 0) {
                    $user = $stmt->fetch();
                    
                    if (password_verify($password, $user['password_hash'])) {
                        // Actualizar último login
                        $update = "UPDATE users SET last_login = NOW() WHERE id = :id";
                        $stmtUpdate = $db->prepare($update);
                        $stmtUpdate->bindParam(':id', $user['id']);
                        $stmtUpdate->execute();
                        
                        // Guardar en sesión
                        $_SESSION['user_id'] = $user['id'];
                        $_SESSION['user_email'] = $user['email'];
                        $_SESSION['user_role'] = $user['role'];
                        $_SESSION['username'] = $user['username'];
                        
                        unset($user['password_hash']);
                        
                        http_response_code(200);
                        echo json_encode([
                            'success' => true,
                            'user' => $user,
                            'message' => 'Login exitoso'
                        ]);
                    } else {
                        http_response_code(401);
                        echo json_encode(['success' => false, 'message' => 'Contraseña incorrecta']);
                    }
                } else {
                    http_response_code(401);
                    echo json_encode(['success' => false, 'message' => 'Usuario no encontrado']);
                }
            } elseif ($input['action'] === 'logout') {
                // Logout
                session_destroy();
                http_response_code(200);
                echo json_encode(['success' => true, 'message' => 'Sesión cerrada']);
            } elseif ($input['action'] === 'register') {
                // Registro (solo admin puede crear usuarios)
                if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'Admin') {
                    http_response_code(403);
                    echo json_encode(['success' => false, 'message' => 'Permiso denegado']);
                    exit();
                }
                
                $email = $input['email'] ?? '';
                $password = $input['password'] ?? '';
                $role = $input['role'] ?? 'Ventas';
                
                if (strlen($password) < 6) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'La contraseña debe tener al menos 6 caracteres']);
                    exit();
                }
                
                $password_hash = password_hash($password, PASSWORD_BCRYPT);
                $username = explode('@', $email)[0];
                
                $query = "INSERT INTO users (email, password_hash, username, role) VALUES (:email, :password_hash, :username, :role)";
                $stmt = $db->prepare($query);
                $stmt->bindParam(':email', $email);
                $stmt->bindParam(':password_hash', $password_hash);
                $stmt->bindParam(':username', $username);
                $stmt->bindParam(':role', $role);
                
                if ($stmt->execute()) {
                    http_response_code(201);
                    echo json_encode(['success' => true, 'message' => 'Usuario creado exitosamente']);
                } else {
                    http_response_code(500);
                    echo json_encode(['success' => false, 'message' => 'Error al crear usuario']);
                }
            }
        }
        break;
        
    case 'GET':
        // Obtener usuario actual
        if (isset($_SESSION['user_id'])) {
            $query = "SELECT id, email, username, role, created_at, last_login FROM users WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindParam(':id', $_SESSION['user_id']);
            $stmt->execute();
            
            $user = $stmt->fetch();
            http_response_code(200);
            echo json_encode(['success' => true, 'user' => $user]);
        } else {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'No autenticado']);
        }
        break;
}
?>
