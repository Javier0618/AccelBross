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
        $query = "SELECT * FROM accounts_payable ORDER BY due_date ASC";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $accounts = $stmt->fetchAll();
        
        http_response_code(200);
        echo json_encode(['success' => true, 'data' => $accounts]);
        break;
        
    case 'PUT':
        $id = $_GET['id'] ?? null;
        $data = $input;
        
        $query = "UPDATE accounts_payable SET status = :status, paid_at = :paid_at WHERE id = :id";
        
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $id);
        $stmt->bindParam(':status', $data['status']);
        $stmt->bindParam(':paid_at', $data['paidAt']);
        
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
