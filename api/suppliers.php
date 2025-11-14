<?php
require_once '../config/database.php';

$database = new Database();
$db = $database->getConnection();

session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autenticado']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch($method) {
    case 'GET':
        $query = "SELECT * FROM suppliers ORDER BY created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $suppliers = $stmt->fetchAll();
        
        http_response_code(200);
        echo json_encode(['success' => true, 'data' => $suppliers]);
        break;
        
    case 'POST':
        $data = $input;
        
        $query = "INSERT INTO suppliers (name, nit, contact, phone, email, website, address, notes, created_by) 
                  VALUES (:name, :nit, :contact, :phone, :email, :website, :address, :notes, :created_by)";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':nit', $data['nit']);
        $stmt->bindParam(':contact', $data['contact']);
        $stmt->bindParam(':phone', $data['phone']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':website', $data['website']);
        $stmt->bindParam(':address', $data['address']);
        $stmt->bindParam(':notes', $data['notes']);
        $stmt->bindParam(':created_by', $_SESSION['user_email']);
        
        if ($stmt->execute()) {
            http_response_code(201);
            echo json_encode(['success' => true, 'id' => $db->lastInsertId()]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false]);
        }
        break;
        
    case 'PUT':
        $id = $_GET['id'] ?? null;
        $data = $input;
        
        $query = "UPDATE suppliers SET name = :name, nit = :nit, contact = :contact, 
                  phone = :phone, email = :email, website = :website, address = :address, notes = :notes 
                  WHERE id = :id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':name', $data['name']);
        $stmt->bindParam(':nit', $data['nit']);
        $stmt->bindParam(':contact', $data['contact']);
        $stmt->bindParam(':phone', $data['phone']);
        $stmt->bindParam(':email', $data['email']);
        $stmt->bindParam(':website', $data['website']);
        $stmt->bindParam(':address', $data['address']);
        $stmt->bindParam(':notes', $data['notes']);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false]);
        }
        break;
        
    case 'DELETE':
        $id = $_GET['id'] ?? null;
        
        $query = "DELETE FROM suppliers WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        
        if ($stmt->execute()) {
            http_response_code(200);
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['success' => false]);
        }
        break;
}
?>
