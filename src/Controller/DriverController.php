<?php

namespace App\Controller;

use App\Service\DriverService;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\Routing\Annotation\Route;

class DriverController extends BaseFleetController
{
    private $driverService;

    public function __construct(DriverService $driverService)
    {
        $this->driverService = $driverService;
    }

    /**
     * @Route("/drivers", name="fleet_drivers")
     */
    public function index(Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $params = ['count' => 100];
        $statusFilter = $request->query->get('status', '');
        if ($statusFilter) {
            $params['status'] = $statusFilter;
        }

        $response = $this->driverService->getList($params);
        $drivers  = [];
        if (isset($response['data']['_embedded']['items'])) {
            $drivers = $response['data']['_embedded']['items'];
        } elseif (isset($response['data']) && is_array($response['data']) && !array_key_exists('page', $response['data'])) {
            $drivers = $response['data'];
        }

        return $this->render('Fleet/drivers/index.html.twig', [
            'drivers'      => $drivers,
            'statusFilter' => $statusFilter,
        ]);
    }

    /**
     * @Route("/drivers/new", name="fleet_driver_new", methods={"GET", "POST"})
     */
    public function new(Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $error    = null;
        $formData = [];

        if ($request->isMethod('POST')) {
            $formData = [
                'firstName'         => $request->request->get('firstName', ''),
                'lastName'          => $request->request->get('lastName', ''),
                'status'            => $request->request->get('status', 'active'),
                'phone'             => $request->request->get('phone', ''),
                'email'             => $request->request->get('email', ''),
                'licenseNumber'     => $request->request->get('licenseNumber', ''),
                'licenseExpiration' => $request->request->get('licenseExpiration', ''),
                'dateOfBirth'       => $request->request->get('dateOfBirth', ''),
            ];

            $payload = array_filter($formData, function ($v) { return $v !== '' && $v !== null; });
            $result  = $this->driverService->create($payload);

            if (!empty($result['data']) || (isset($result['outcome']) && $result['outcome'] === 'success')) {
                $this->addFlash('success', 'Driver created successfully.');
                return $this->redirectToRoute('fleet_drivers');
            }

            $error = isset($result['message']) ? $result['message'] : 'Failed to create driver.';
        }

        return $this->render('Fleet/drivers/new.html.twig', [
            'error'    => $error,
            'formData' => $formData,
        ]);
    }

    /**
     * @Route("/drivers/{id}/edit", name="fleet_driver_edit", methods={"GET", "POST"})
     */
    public function edit($id, Request $request, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $driverResponse = $this->driverService->get($id);
        $driver         = isset($driverResponse['data']) ? $driverResponse['data'] : null;

        if (!$driver) {
            $this->addFlash('error', 'Driver not found.');
            return $this->redirectToRoute('fleet_drivers');
        }

        $error    = null;
        $formData = [
            'firstName'         => $driver['first_name'] ?? '',
            'lastName'          => $driver['last_name'] ?? '',
            'status'            => $driver['status'] ?? 'active',
            'phone'             => $driver['phone'] ?? '',
            'email'             => $driver['email'] ?? '',
            'licenseNumber'     => $driver['license_number'] ?? '',
            'licenseExpiration' => $driver['license_expiration'] ?? '',
            'dateOfBirth'       => $driver['date_of_birth'] ?? '',
        ];

        if ($request->isMethod('POST')) {
            $formData = [
                'firstName'         => $request->request->get('firstName', ''),
                'lastName'          => $request->request->get('lastName', ''),
                'status'            => $request->request->get('status', 'active'),
                'phone'             => $request->request->get('phone', ''),
                'email'             => $request->request->get('email', ''),
                'licenseNumber'     => $request->request->get('licenseNumber', ''),
                'licenseExpiration' => $request->request->get('licenseExpiration', ''),
                'dateOfBirth'       => $request->request->get('dateOfBirth', ''),
            ];

            $payload = array_filter($formData, function ($v) { return $v !== '' && $v !== null; });
            $result  = $this->driverService->update($id, $payload);

            if (isset($result['outcome']) && $result['outcome'] === 'success') {
                $this->addFlash('success', 'Driver updated successfully.');
                return $this->redirectToRoute('fleet_drivers');
            }

            $error = isset($result['message']) ? $result['message'] : 'Failed to update driver.';
        }

        return $this->render('Fleet/drivers/edit.html.twig', [
            'driver'   => $driver,
            'formData' => $formData,
            'error'    => $error,
        ]);
    }

    /**
     * @Route("/drivers/{id}/delete", name="fleet_driver_delete", methods={"POST"})
     */
    public function delete($id, SessionInterface $session): Response
    {
        if (!$this->isAuthenticated($session)) {
            return $this->redirectToRoute('fleet_login');
        }

        $this->driverService->delete($id);
        $this->addFlash('success', 'Driver deleted successfully.');
        return $this->redirectToRoute('fleet_drivers');
    }
}
